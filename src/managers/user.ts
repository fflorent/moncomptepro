import { isEmpty } from 'lodash';
import { isEmailSafeToSendTransactional } from '../connectors/debounce';
import { sendMail } from '../connectors/sendinblue';
import {
  EmailUnavailableError,
  EmailVerifiedAlreadyError,
  InvalidCredentialsError,
  InvalidEmailError,
  InvalidMagicLinkError,
  InvalidTokenError,
  LeakedPasswordError,
  UserNotFoundError,
  WeakPasswordError,
} from '../errors';

import {
  create,
  findByEmail,
  findByMagicLinkToken,
  findByResetPasswordToken,
  update,
} from '../repositories/user';
import { getDidYouMeanSuggestion } from '../services/did-you-mean';
import { isExpired } from '../services/is-expired';
import {
  generatePinToken,
  generateToken,
  hashPassword,
  isPasswordSecure,
  validatePassword,
} from '../services/security';
import { hasPasswordBeenPwned } from '../connectors/pwnedpasswords';
import {
  MAGIC_LINK_TOKEN_EXPIRATION_DURATION_IN_MINUTES,
  MAX_DURATION_BETWEEN_TWO_EMAIL_ADDRESS_VERIFICATION_IN_MINUTES,
  RESET_PASSWORD_TOKEN_EXPIRATION_DURATION_IN_MINUTES,
  VERIFY_EMAIL_TOKEN_EXPIRATION_DURATION_IN_MINUTES,
} from '../env';

export const startLogin = async (
  email: string
): Promise<{ email: string; userExists: boolean }> => {
  const userExists = !isEmpty(await findByEmail(email));

  if (userExists) {
    return { email, userExists: true };
  }

  let { isEmailSafeToSend, didYouMean } = await isEmailSafeToSendTransactional(
    email
  );

  if (!isEmailSafeToSend) {
    if (!didYouMean) {
      didYouMean = getDidYouMeanSuggestion(email);
    }

    throw new InvalidEmailError(didYouMean);
  }

  return { email, userExists: false };
};

export const login = async (email: string, password: string): Promise<User> => {
  const user = await findByEmail(email);
  if (isEmpty(user)) {
    // this is not a proper error name but this case should never happen
    // we throw a clean error as a mesure of defensive programming
    throw new InvalidCredentialsError();
  }

  const isMatch = await validatePassword(password, user.encrypted_password);

  if (!isMatch) {
    throw new InvalidCredentialsError();
  }

  return await update(user.id, {
    sign_in_count: user.sign_in_count + 1,
    last_sign_in_at: new Date(),
  });
};

export const signup = async (
  email: string,
  password: string
): Promise<User> => {
  const user = await findByEmail(email);

  if (!isEmpty(user)) {
    throw new EmailUnavailableError();
  }

  if (!isPasswordSecure(password, email)) {
    throw new WeakPasswordError();
  }

  if (await hasPasswordBeenPwned(password)) {
    throw new LeakedPasswordError();
  }

  const hashedPassword = await hashPassword(password);

  return await create({
    email,
    encrypted_password: hashedPassword,
    last_sign_in_at: new Date(),
  });
};

export const sendEmailAddressVerificationEmail = async ({
  email,
  checkBeforeSend,
}: {
  email: string;
  checkBeforeSend: boolean;
}): Promise<boolean> => {
  const user = await findByEmail(email);

  if (isEmpty(user)) {
    throw new UserNotFoundError();
  }

  if (user.email_verified) {
    throw new EmailVerifiedAlreadyError();
  }

  if (
    checkBeforeSend &&
    !isExpired(
      user.verify_email_sent_at,
      VERIFY_EMAIL_TOKEN_EXPIRATION_DURATION_IN_MINUTES
    )
  ) {
    return false;
  }

  const verify_email_token = await generatePinToken();
  const readable_verify_email_token = verify_email_token.replace(
    /(.{3})/g,
    '$1 '
  );

  await update(user.id, {
    verify_email_token,
    verify_email_sent_at: new Date(),
  });

  await sendMail({
    to: [user.email],
    subject: 'Vérification de votre adresse email',
    template: 'verify-email',
    params: {
      verify_email_token: readable_verify_email_token,
    },
  });

  return true;
};

export const verifyEmail = async (
  email: string,
  token: string
): Promise<User> => {
  const user = await findByEmail(email);

  if (isEmpty(user)) {
    throw new UserNotFoundError();
  }

  if (user.verify_email_token !== token) {
    throw new InvalidTokenError();
  }

  const isTokenExpired = isExpired(
    user.verify_email_sent_at,
    VERIFY_EMAIL_TOKEN_EXPIRATION_DURATION_IN_MINUTES
  );

  if (isTokenExpired) {
    throw new InvalidTokenError();
  }

  return await update(user.id, {
    email_verified: true,
    email_verified_at: new Date(),
    verify_email_token: null,
    verify_email_sent_at: null,
  });
};

export const updateEmailAddressVerificationStatus = async (
  email: string
): Promise<{ user: User; needs_email_verification_renewal: boolean }> => {
  const user = await findByEmail(email);

  if (isEmpty(user)) {
    throw new UserNotFoundError();
  }

  if (
    user.email_verified &&
    isExpired(
      user.email_verified_at,
      MAX_DURATION_BETWEEN_TWO_EMAIL_ADDRESS_VERIFICATION_IN_MINUTES
    )
  ) {
    const updatedUser = await update(user.id, {
      email_verified: false,
    });

    return { user: updatedUser, needs_email_verification_renewal: true };
  }

  return { user, needs_email_verification_renewal: false };
};

export const sendSendMagicLinkEmail = async (
  email: string,
  host: string
): Promise<boolean> => {
  let user = await findByEmail(email);

  if (isEmpty(user)) {
    user = await create({
      email,
      last_sign_in_at: new Date(),
    });
  }

  const magicLinkToken = await generateToken();

  await update(user.id, {
    magic_link_token: magicLinkToken,
    magic_link_sent_at: new Date(),
  });

  await sendMail({
    to: [user.email],
    subject: 'Lien de connexion à MonComptePro',
    template: 'magic-link',
    params: {
      magic_link: `${host}/users/sign-in-with-magic-link?magic_link_token=${magicLinkToken}`,
    },
  });

  return true;
};

export const loginWithMagicLink = async (token: string): Promise<User> => {
  // check that token as not the default empty value as it will match all users
  if (!token) {
    throw new InvalidMagicLinkError();
  }

  const user = await findByMagicLinkToken(token);

  if (isEmpty(user)) {
    throw new InvalidMagicLinkError();
  }

  const isTokenExpired = isExpired(
    user.magic_link_sent_at,
    MAGIC_LINK_TOKEN_EXPIRATION_DURATION_IN_MINUTES
  );

  if (isTokenExpired) {
    throw new InvalidMagicLinkError();
  }

  return await update(user.id, {
    email_verified: true,
    email_verified_at: new Date(),
    magic_link_token: null,
    magic_link_sent_at: null,
    last_sign_in_at: new Date(),
  });
};

export const sendResetPasswordEmail = async (
  email: string,
  host: string
): Promise<boolean> => {
  const user = await findByEmail(email);

  if (isEmpty(user)) {
    // failing silently as we do not want to give info on whether the user exists or not
    return true;
  }

  const resetPasswordToken = await generateToken();

  await update(user.id, {
    reset_password_token: resetPasswordToken,
    reset_password_sent_at: new Date(),
  });

  await sendMail({
    to: [user.email],
    subject: 'Instructions pour la réinitialisation du mot de passe',
    template: 'reset-password',
    params: {
      reset_password_link: `${host}/users/change-password?reset_password_token=${resetPasswordToken}`,
    },
  });

  return true;
};

export const changePassword = async (
  token: string,
  password: string
): Promise<User> => {
  // check that token as not the default empty value as it will match all users
  if (!token) {
    throw new InvalidTokenError();
  }

  const user = await findByResetPasswordToken(token);

  if (isEmpty(user)) {
    throw new InvalidTokenError();
  }

  const isTokenExpired = isExpired(
    user.reset_password_sent_at,
    RESET_PASSWORD_TOKEN_EXPIRATION_DURATION_IN_MINUTES
  );

  if (isTokenExpired) {
    throw new InvalidTokenError();
  }

  if (!isPasswordSecure(password, user.email)) {
    throw new WeakPasswordError();
  }

  if (await hasPasswordBeenPwned(password)) {
    throw new LeakedPasswordError();
  }

  const hashedPassword = await hashPassword(password);

  return await update(user.id, {
    encrypted_password: hashedPassword,
    email_verified: true,
    email_verified_at: new Date(),
    reset_password_token: null,
    reset_password_sent_at: null,
  });
};

export const updatePersonalInformations = async (
  userId: number,
  {
    given_name,
    family_name,
    phone_number,
    job,
  }: Pick<User, 'given_name' | 'family_name' | 'phone_number' | 'job'>
): Promise<User> => {
  return await update(userId, {
    given_name,
    family_name,
    phone_number,
    job,
  });
};
