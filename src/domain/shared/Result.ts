/**
 * Result pattern for handling success/failure without exceptions
 */
export class Result<T> {
  public readonly isSuccess: boolean;
  public readonly isFailure: boolean;
  public readonly error?: string;
  private readonly _value?: T;

  private constructor(isSuccess: boolean, error?: string, value?: T) {
    this.isSuccess = isSuccess;
    this.isFailure = !isSuccess;
    this.error = error;
    this._value = value;

    Object.freeze(this);
  }

  public getValue(): T {
    if (!this.isSuccess) {
      throw new Error('Cannot get value from a failed result');
    }
    return this._value as T;
  }

  public static ok<U>(value?: U): Result<U> {
    return new Result<U>(true, undefined, value);
  }

  public static fail<U>(error: string): Result<U> {
    return new Result<U>(false, error);
  }

  public static combine(results: Result<unknown>[]): Result<void> {
    for (const result of results) {
      if (result.isFailure) {
        return Result.fail(result.error!);
      }
    }
    return Result.ok();
  }
}
