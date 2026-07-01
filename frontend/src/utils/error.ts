import { type ApolloError } from '@apollo/client';

type ValidatorError = {
  error: string;
  field: string;
};

export const handleApolloError = (error: ApolloError): string => {
  const { message } = error;

  try {
    const parsedMessage = JSON.parse(message) as ValidatorError[];

    const isObject = typeof parsedMessage === 'object';

    if (isObject) {
      const errorArray = Array.isArray(parsedMessage) ? parsedMessage : [];
      return errorArray.map((err) => `${err.error}`).join(', ');
    }

    const isString = typeof parsedMessage === 'string';
    if (isString) {
      return parsedMessage;
    }
  } catch {
    return message;
  }

  return 'Error occurred';
};

export const onError = (err: ApolloError) => {
  console.error(err.message);
  throw err;
};
