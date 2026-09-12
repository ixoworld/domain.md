import type { ValidateFunction } from 'ajv';
declare const validators: {
  domain: ValidateFunction;
  manifest: ValidateFunction;
  sourceLock: ValidateFunction;
};
export default validators;
