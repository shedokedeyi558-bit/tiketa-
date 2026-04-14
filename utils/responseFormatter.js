/**
 * Standardized Response Formatter
 * All API responses follow this format:
 * {
 *   "success": boolean,
 *   "message": string,
 *   "data": object
 * }
 */

export const successResponse = (res, data, message = 'Success', statusCode = 200) => {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
  });
};

export const errorResponse = (res, error, message = 'Error', statusCode = 500) => {
  return res.status(statusCode).json({
    success: false,
    message,
    error: typeof error === 'string' ? error : error?.message || 'Unknown error',
  });
};

export const createdResponse = (res, data, message = 'Created successfully') => {
  return successResponse(res, data, message, 201);
};

export const notFoundResponse = (res, message = 'Resource not found') => {
  return errorResponse(res, message, message, 404);
};

export const unauthorizedResponse = (res, message = 'Unauthorized') => {
  return errorResponse(res, message, message, 401);
};

export const badRequestResponse = (res, message = 'Bad request') => {
  return errorResponse(res, message, message, 400);
};
