// @ts-ignore
import {describe, it} from 'node:test';
// @ts-ignore
import assert from 'node:assert/strict';

export {describe, it};

const ARRAY_CONTAINING = Symbol('arrayContaining');
const STRING_MATCHING = Symbol('stringMatching');

export function expect(actual: unknown, message?: string) {
  return {
    toBe(expected: unknown) {
      assert.strictEqual(actual, expected, message);
    },
    toEqual(expected: unknown) {
      if (expected && typeof expected === 'object' && (expected as any)[ARRAY_CONTAINING]) {
        const expectedItems = (expected as any).expected as unknown[];
        assert.ok(Array.isArray(actual), message || 'Expected array for arrayContaining');
        for (const item of expectedItems) {
          assert.ok((actual as unknown[]).includes(item), message || `Expected array to contain ${item}`);
        }
        return;
      }
      assert.deepStrictEqual(actual, expected, message);
    },
    toMatchObject(expected: Record<string, unknown>) {
      for (const [key, value] of Object.entries(expected)) {
        const act = (actual as Record<string, unknown>)[key];
        if (value && typeof value === 'object' && (value as any)[STRING_MATCHING]) {
          const pattern = (value as any).pattern;
          if (typeof pattern === 'string') {
            assert.ok(String(act).includes(pattern), message || `Expected "${act}" to include "${pattern}"`);
          } else if (pattern instanceof RegExp) {
            assert.ok(pattern.test(String(act)), message || `Expected "${act}" to match ${pattern}`);
          }
        } else {
          assert.deepStrictEqual(act, value, message);
        }
      }
    },
    toHaveLength(expected: number) {
      assert.strictEqual((actual as unknown[]).length, expected, message);
    },
    toBeDefined() {
      assert.notStrictEqual(actual, undefined, message);
    },
    toBeNull() {
      assert.strictEqual(actual, null, message);
    },
    toBeLessThan(expected: number) {
      assert.ok((actual as number) < expected, message || `Expected ${actual} to be less than ${expected}`);
    },
    toBeLessThanOrEqual(expected: number) {
      assert.ok((actual as number) <= expected, message || `Expected ${actual} to be less than or equal to ${expected}`);
    },
    toBeGreaterThan(expected: number) {
      assert.ok((actual as number) > expected, message || `Expected ${actual} to be greater than ${expected}`);
    },
    toBeGreaterThanOrEqual(expected: number) {
      assert.ok((actual as number) >= expected, message || `Expected ${actual} to be greater than or equal to ${expected}`);
    },
    toBeCloseTo(expected: number, numDigits = 2) {
      const diff = Math.abs((actual as number) - expected);
      assert.ok(diff < Math.pow(10, -numDigits) / 2, message || `Expected ${actual} to be close to ${expected}`);
    },
    toBeTypeOf(expectedType: string) {
      assert.strictEqual(typeof actual, expectedType, message);
    },
    toContain(expected: unknown) {
      if (typeof actual === 'string') {
        assert.ok(actual.includes(expected as string), message || `Expected string "${actual}" to contain "${expected}"`);
      } else if (Array.isArray(actual) || (actual instanceof Set)) {
        let found = false;
        for (const item of actual as Iterable<unknown>) {
          try {
            assert.deepStrictEqual(item, expected);
            found = true;
            break;
          } catch {}
        }
        assert.ok(found, message || `Expected collection to contain ${JSON.stringify(expected)}`);
      } else {
        throw new Error('toContain called on non-collection');
      }
    },
    toHaveBeenCalled() {
      assert.ok((actual as any).toHaveBeenCalled(), message || 'Expected mock to have been called');
    },
    toHaveBeenCalledWith(...args: any[]) {
      (actual as any).toHaveBeenCalledWith(...args);
    },
    toHaveBeenCalledTimes(times: number) {
      (actual as any).toHaveBeenCalledTimes(times);
    },
    toHaveBeenCalledOnce() {
      (actual as any).toHaveBeenCalledOnce();
    },
    not: {
      toBe(expected: unknown) {
        assert.notStrictEqual(actual, expected, message);
      },
      toBeNull() {
        assert.notStrictEqual(actual, null, message);
      },
      toThrow() {
        if (typeof actual === 'function') {
          assert.doesNotThrow(actual as () => void, message);
        }
      },
    },
    toThrow(matcher?: unknown) {
      if (typeof actual !== 'function') throw new Error('Expected function to throw');
      assert.throws(actual as () => void, matcher as any, message);
    },
    rejects: {
      async toThrow(expectedError?: string | RegExp) {
        let threw = false;
        try {
          await (actual as Promise<any>);
        } catch (err: any) {
          threw = true;
          if (expectedError) {
            const msg = err instanceof Error ? err.message : String(err);
            if (typeof expectedError === 'string') {
              assert.ok(msg.includes(expectedError), `Expected error "${msg}" to contain "${expectedError}"`);
            } else if (expectedError instanceof RegExp) {
              assert.ok(expectedError.test(msg), `Expected error "${msg}" to match ${expectedError}`);
            }
          }
        }
        assert.ok(threw, 'Expected promise to reject with an error');
      }
    }
  };
}

expect.arrayContaining = (expected: unknown[]) => ({
  [ARRAY_CONTAINING]: true,
  expected,
});

expect.stringMatching = (pattern: RegExp | string) => ({
  [STRING_MATCHING]: true,
  pattern,
});

export const vi = {
  fn(impl?: (...args: any[]) => any) {
    const calls: any[][] = [];
    const mock: any = (...args: any[]) => {
      calls.push(args);
      return impl ? impl(...args) : undefined;
    };
    mock.mock = { calls };
    mock.toHaveBeenCalled = () => calls.length > 0;
    mock.toHaveBeenCalledWith = (...expected: any[]) => assert.deepStrictEqual(calls[calls.length - 1], expected);
    mock.toHaveBeenCalledTimes = (times: number) => assert.strictEqual(calls.length, times);
    mock.toHaveBeenCalledOnce = () => assert.strictEqual(calls.length, 1);
    return mock;
  },
  async waitFor(callback: () => void | Promise<void>, timeout = 1000) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      try {
        await callback();
        return;
      } catch {
        await new Promise(r => setTimeout(r, 10));
      }
    }
    await callback();
  }
};
