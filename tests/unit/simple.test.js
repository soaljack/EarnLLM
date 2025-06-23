/**
 * Simple test to verify test environment is working
 */

describe('Basic Test Environment', () => {
  test('should perform a simple assertion', () => {
    expect(1 + 1).toBe(2);
  });

  test('should handle a Promise', async () => {
    const result = await Promise.resolve('success');
    expect(result).toBe('success');
  });

  test('should handle mock functions', () => {
    const mockFn = jest.fn().mockReturnValue('mocked');
    expect(mockFn()).toBe('mocked');
    expect(mockFn).toHaveBeenCalled();
  });
});
