// domain/repositories/IAuthRepository.js
// Abstract contract — any class that implements login() can be injected

/**
 * @interface IAuthRepository
 * All auth repository implementations must have this method:
 *
 * login({ userId, password, oldUserId }): Promise<LoginResponse>
 */