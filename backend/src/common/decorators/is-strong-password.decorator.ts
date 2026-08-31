import { registerDecorator, ValidationArguments, ValidationOptions } from 'class-validator';
import { PASSWORD_POLICY, passwordPolicyProblem } from '../utils/password.util';

/**
 * Class-validator decorator enforcing the shared strong-password policy
 * (length, character classes, common/sequential/repeated password rejection).
 */
export function IsStrongPassword(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isStrongPassword',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown): boolean {
          return passwordPolicyProblem(value) === null;
        },
        defaultMessage(_args: ValidationArguments): string {
          return `password must meet the policy — ${PASSWORD_POLICY.description}`;
        },
      },
    });
  };
}