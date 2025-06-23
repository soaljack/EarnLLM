const dotenv = require('dotenv');
const path = require('path');

// Load environment variables from the main .env file.
// This runs before any other setup or test code.
dotenv.config({ path: path.resolve(__dirname, '../.env') });
