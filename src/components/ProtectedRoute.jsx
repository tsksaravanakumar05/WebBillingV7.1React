import { Navigate } from "react-router-dom";

/**
 * Wraps any route that requires authentication.
 * Reads the JWT token stored in localStorage after login.
 * If the token is missing, the user is redirected to the login page.
 */
const ProtectedRoute = ({ children }) => {
//   const token = localStorage.getItem("token");

//   if (!token) {
//     // Not authenticated → send back to login
//     return <Navigate to="/" replace />;
//   }

//   return children;
// };

const userid = localStorage.getItem("userid");
  const comid  = localStorage.getItem("Comid");

  if (!userid || userid === "" || userid === "0" || !comid) {
    return <Navigate to="/" replace />;
  }

  return children;
};

export default ProtectedRoute;
