// infrastructure/repositories/AuthRepository.js

import { AuthApi } from "../api/AuthApi.js";

export class AuthRepository {
  constructor(api = new AuthApi()) {
    this.api = api;
  }

  async login(credentials) {
    return this.api.login(credentials);
  }
}