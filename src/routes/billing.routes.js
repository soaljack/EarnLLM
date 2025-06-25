const express = require('express');
const createError = require('http-errors');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const {
  BillingAccount,
  PricingPlan,
  User,
  sequelize,
} = require('../models');
const authMiddleware = require('../middleware/auth.middleware');

const router = express.Router();

/**
 * @route GET /api/billing/plans
 * @desc Get all available pricing plans
 * @access Private
 */
router.get('/plans', authMiddleware.authenticateApiKey, async (req, res, next) => {
  try {
    // Get all active pricing plans
    const plans = await PricingPlan.findAll({
      where: { isActive: true },
      attributes: [
        'id', 'name', 'code', 'description', 'monthlyFee',
        'tokenAllowance', 'requestsPerDay', 'requestsPerMinute',
        'featuredModels', 'supportSla', 'allowBYOM',
      ],
      order: [['monthlyFee', 'ASC']],
    });

    return res.json(plans);
  } catch (error) {
    return next(error);
  }
});

/**
 * @route GET /api/billing/subscription
 * @desc Get user's current subscription details
 * @access Private
 */
router.get('/subscription', authMiddleware.authenticateApiKey, async (req, res, next) => {
  try {
    // Get user's billing account and pricing plan
    const [billingAccount, pricingPlan] = await Promise.all([
      BillingAccount.findOne({ where: { UserId: req.user.id } }),
      req.user.getPricingPlan(),
    ]);

    if (!billingAccount) {
      return next(createError(404, 'Billing account not found'));
    }

    return res.json({
      billingAccount: billingAccount.toJSON(),
      currentPlan: {
        id: pricingPlan.id,
        name: pricingPlan.name,
        code: pricingPlan.code,
        monthlyFee: pricingPlan.monthlyFee,
        tokenAllowance: pricingPlan.tokenAllowance,
        requestsPerDay: pricingPlan.requestsPerDay,
        requestsPerMinute: pricingPlan.requestsPerMinute,
        allowBYOM: pricingPlan.allowBYOM,
      },
      subscription: {
        status: billingAccount.subscriptionStatus,
        currentPeriodStart: billingAccount.currentPeriodStart,
        currentPeriodEnd: billingAccount.currentPeriodEnd,
      },
      usage: {
        tokenUsageThisMonth: billingAccount.tokenUsageThisMonth,
        creditBalance: billingAccount.creditBalance,
      },
      paymentMethod: billingAccount.paymentMethod,
      billingEmail: billingAccount.billingEmail,
      paymentsEnabled: billingAccount.paymentsEnabled,
      stripeCustomerId: billingAccount.stripeCustomerId,
    });
  } catch (error) {
    return next(error);
  }
});

/**
 * @route POST /api/billing/checkout-session
 * @desc Create a Stripe checkout session for subscription
 * @access Private
 */
router.post('/checkout-session', authMiddleware.authenticateApiKey, async (req, res, next) => {
  try {
    const { planId } = req.body;

    if (!planId) {
      return next(createError(400, 'Plan ID is required'));
    }

    // Get the pricing plan
    const plan = await PricingPlan.findByPk(planId);
    if (!plan || !plan.isActive) {
      return next(createError(404, 'Pricing plan not found or inactive'));
    }

    // Get or create Stripe customer
    const billingAccount = await BillingAccount.findOne({
      where: { UserId: req.user.id },
    });

    let customerId = billingAccount.stripeCustomerId;

    if (!customerId) {
      // Create new Stripe customer
      const customer = await stripe.customers.create({
        email: req.user.email,
        name: `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim() || req.user.email,
        metadata: {
          userId: req.user.id,
        },
      });

      customerId = customer.id;

      // Update billing account with Stripe customer ID
      await billingAccount.update({ stripeCustomerId: customerId });
    }

    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [
        {
          price: plan.stripePriceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `${process.env.FRONTEND_URL}/dashboard/billing?success=true`,
      cancel_url: `${process.env.FRONTEND_URL}/pricing?canceled=true`,
      metadata: {
        userId: req.user.id,
        planId: plan.id,
      },
    });

    return res.json({
      sessionId: session.id,
      url: session.url,
    });
  } catch (error) {
    return next(error);
  }
});

/**
 * @route POST /api/billing/portal-session
 * @desc Create a Stripe customer portal session
 * @access Private
 */
router.post('/portal-session', authMiddleware.authenticateApiKey, async (req, res, next) => {
  try {
    const billingAccount = await BillingAccount.findOne({
      where: { UserId: req.user.id },
    });

    if (!billingAccount || !billingAccount.stripeCustomerId) {
      return next(createError(400, 'No Stripe customer found for this account'));
    }

    // Create customer portal session
    const session = await stripe.billingPortal.sessions.create({
      customer: billingAccount.stripeCustomerId,
      return_url: `${process.env.FRONTEND_URL}/dashboard/billing`,
    });

    return res.json({
      url: session.url,
    });
  } catch (error) {
    return next(error);
  }
});

/**
 * @route POST /api/billing/add-credits
 * @desc Create a payment intent to add credits to account
 * @access Private
 */
router.post('/add-credits', authMiddleware.authenticateApiKey, async (req, res, next) => {
  try {
    const amountNum = Number(req.body.amountUsd);

    if (Number.isNaN(amountNum) || amountNum < 5) {
      return next(createError(400, 'Amount must be a number and at least $5.'));
    }

    const billingAccount = await BillingAccount.findOne({
      where: { UserId: req.user.id },
    });

    // Get or create Stripe customer
    let customerId = billingAccount.stripeCustomerId;

    if (!customerId) {
      // Create new Stripe customer
      const customer = await stripe.customers.create({
        email: req.user.email,
        name: `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim() || req.user.email,
        metadata: {
          userId: req.user.id,
        },
      });

      customerId = customer.id;

      // Update billing account with Stripe customer ID
      await billingAccount.update({ stripeCustomerId: customerId });
    }

    // Create a payment intent for adding credits
    const amountCents = Math.round(amountNum * 100);
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountCents,
      currency: 'usd',
      customer: customerId,
      metadata: {
        userId: req.user.id,
        amountUsd: amountNum,
      },
    });

    return res.json({
      clientSecret: paymentIntent.client_secret,
    });
  } catch (error) {
    return next(error);
  }
});

/**
 * @route POST /api/billing/webhook
 * @desc Handle Stripe webhook events
 * @access Public
 */
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];

  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET,
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  const t = await sequelize.transaction();
  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        if (session.mode === 'subscription') {
          const { userId, planId } = session.metadata;
          await User.update(
            { PricingPlanId: planId },
            { where: { id: userId }, transaction: t },
          );
          await BillingAccount.update(
            {
              stripeSubscriptionId: session.subscription,
              subscriptionStatus: 'active',
              paymentsEnabled: true,
            },
            { where: { UserId: userId }, transaction: t },
          );
        }
        break;
      }

      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object;
        if (paymentIntent.metadata.type === 'credits') {
          const { userId } = paymentIntent.metadata;
          const amountCents = paymentIntent.amount;
          const billingAccount = await BillingAccount.findOne({
            where: { UserId: userId },
            transaction: t,
          });
          if (billingAccount) {
            await billingAccount.increment('creditBalance', { by: amountCents, transaction: t });
          }
        }
        break;
      }

      case 'subscription_schedule.canceled':
      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        const billingAccount = await BillingAccount.findOne({
          where: { stripeSubscriptionId: subscription.id },
          transaction: t,
        });
        if (billingAccount) {
          billingAccount.subscriptionStatus = 'canceled';
          await billingAccount.save({ transaction: t });

          const freeTier = await PricingPlan.findOne({ where: { code: 'starter' }, transaction: t });
          if (freeTier) {
            await User.update(
              { PricingPlanId: freeTier.id },
              { where: { id: billingAccount.UserId }, transaction: t },
            );
          }
        }
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object;
        await BillingAccount.update(
          {
            subscriptionStatus: subscription.status,
            currentPeriodStart: new Date(subscription.current_period_start * 1000),
            currentPeriodEnd: new Date(subscription.current_period_end * 1000),
          },
          { where: { stripeSubscriptionId: subscription.id }, transaction: t },
        );
        break;
      }

      default:
        console.log(`Unhandled event type ${event.type}`);
    }

    await t.commit();
    return res.json({ received: true });
  } catch (error) {
    await t.rollback();
    console.error(`Error processing webhook: ${error.message}`);
    return res.status(500).json({ error: 'Webhook processing failed' });
  }
});

module.exports = router;
