// application/usecases/LoginUseCase.js
// Orchestrates: validate → call repo → persist session → return result
// No framework, no fetch, no React — pure business logic

import { SessionService } from "../../domain/services/SessionService.js";
import { validateLoginFields } from "../../shared/helpers/validation.js";

export class LoginUseCase {
  /**
   * @param {import('../../domain/repositories/IAuthRepository.js')} authRepo
   */
  constructor(authRepo) {
    this.authRepo = authRepo;
  }

  /**
   * @param {{ username: string, password: string }} dto
   * @returns {Promise<{ success: boolean, redirectTo?: string, errorMessage?: string }>}
   */
  async execute({ username, password }) {
    const validation = validateLoginFields(username, password);

    if (!validation.isValid) {
      return { success: false, errorMessage: validation.message };
    }

    try {
      const oldUserId = SessionService.getOldUserId();

      const response = await this.authRepo.login({
        userId: username,
        password,
        oldUserId,
      });

      if (!response.ok) {
        return { success: false, errorMessage: response.message ?? "Login failed" };
      }
// Login success aana udane idhai podanum
localStorage.setItem("username", response.user.username); 
localStorage.setItem("menulist", response.menuList); // <-- Intha line mukkiyam
      // Persist all localStorage data (original success block)
      SessionService.persist(response, username);

      return { success: true, redirectTo: "/Home/Index" };
    } catch {
      return {
        success: false,
        errorMessage: "Technical Fault Contact Software Vendor !!!.",
      };
    }
  }
}