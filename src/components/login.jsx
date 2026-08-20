import React, { useRef, useState } from "react";
import "../index.css";
import { useNavigate } from "react-router-dom";
import Image from "../assets/image.png";
import Logo from "../assets/logo.png";

import { FaEye, FaEyeSlash } from "react-icons/fa";
import * as CC from "../components/Common";

const Login = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [loginFailedOpen, setLoginFailedOpen] = useState(false);
  const loginFailedResolveRef = useRef(null);
  const navigate = useNavigate();

  const showLoginFailedPopup = () =>
    new Promise((resolve) => {
      loginFailedResolveRef.current = resolve;
      setLoginFailedOpen(true);
    });

  const closeLoginFailedPopup = () => {
    setLoginFailedOpen(false);
    loginFailedResolveRef.current?.();
    loginFailedResolveRef.current = null;
  };

  const setFieldBorder = (id, border) => {
    const el = document.getElementById(id);
    if (el) el.style.border = border;
  };

  const resetFieldBorders = () => {
    setFieldBorder("txtUsername", "");
    setFieldBorder("Password", "");
  };

  const handleLogin = async () => {
    resetFieldBorders();

    if (!email) {
      alert("Please Enter the Username !!!.");
      setFieldBorder("Password", "2px solid #0072c6");
      setFieldBorder("txtUsername", "2px solid red");
      return;
    }

    if (!password) {
      alert("Please Enter the Password !!!.");
      setFieldBorder("Password", "2px solid red");
      setFieldBorder("txtUsername", "2px solid #0072c6");
      return;
    }

    const olduserid = localStorage.getItem("userid") || "";
    localStorage.removeItem("lastBillNo");
    localStorage.removeItem("lastBillAmt");
    const qs = new URLSearchParams({
      Userid: email,
      Pwd: password,
      olduserid: "",
    }).toString();
    setLoading(true);
    try {
      const res = await fetch(`${CC.BASE_URL}/api/loginApp/WebLoginSuccess?${qs}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json; charset=utf-8",
        },
        body: JSON.stringify({
          Userid: email,
          Pwd: password,
          olduserid,
        }),
      });

      if (!res.ok) {
        const txt = await res.text();
        console.error(`[Login] HTTP ${res.status}:`, txt);
        await showLoginFailedPopup();
        return;
      }

      const data = await res.json();
      const success = data.ok === true || data.IsSuccess === true;

      if (!success) {
        await showLoginFailedPopup();
        return;
      }

      const gedata = data.data ?? data.Data1;
      if (!Array.isArray(gedata) || !gedata[0]) {
        alert("Login failed: no user data returned.");
        return;
      }

      const user = gedata[0];
      const comdata = data.Comdata?.[0] || {};
      const maindata = data.Maindata?.[0] || {};

      localStorage.setItem("token", data.Data14 || data.Token || "");
      localStorage.setItem("Profile", data.Data15 || data.Profile || "Admin");
      localStorage.setItem("LoginCheck", "1");
      localStorage.setItem("popupalert", "1");
      localStorage.setItem("LoginCount", "0");
      sessionStorage.setItem("home", "1");

      localStorage.setItem("userid", String(user.UserId ?? ""));
      localStorage.setItem("username", email);
      localStorage.setItem("priv", user.Priv ?? "");
      localStorage.setItem("Comid", String(user.Comid ?? "1"));
      localStorage.setItem("LComid", String(user.Comid ?? "1"));
      localStorage.setItem("MComid", String(user.MComid ?? user.Comid ?? "1"));
      localStorage.setItem("HoCompany", user.Comid == user.MComid ? "1" : "0");
      localStorage.setItem("CompanyName", user.CompanyName ?? "");
      localStorage.setItem("menulistload", data.Menulist ?? "");
      localStorage.setItem("menulist", JSON.stringify(data.Menudata ?? []));
      localStorage.setItem("Mainsetting", JSON.stringify(data.Maindata ?? []));

      const objComIdList = data.objComIdList ?? [];
      localStorage.setItem(
        "IdComList",
        typeof objComIdList === "string" ? objComIdList : JSON.stringify(objComIdList)
      );

      localStorage.setItem("CommonCompany", maindata.CommonCompany ?? "0");
      localStorage.setItem("SupplierCommon", maindata.SupplierCommonCompany ?? "0");
      localStorage.setItem("Tamil", maindata.ProductNameTamil ?? "0");

      // if (olduserid !== String(user.UserId ?? "")) {
        localStorage.setItem(
          "Address",
          `${comdata.Address1 || ""} ${comdata.Address2 || ""} ${comdata.City || ""}`.trim()
        );
        localStorage.setItem("Phone", `Phone No :${comdata.Phone || ""}`);
        localStorage.setItem("CashierRefid", data.CashierId ?? "");
        localStorage.setItem("parentcashid", data.Cashid ?? "");
        localStorage.setItem("CustomerCashid", data.CustomerCashId ?? "");
        localStorage.setItem("CreditId", data.CreditId ?? "");
        localStorage.setItem("MirrorTableOnline", maindata.MirrorTableOnline ?? "0");
        localStorage.setItem("MirrorTable", maindata.MirrorTableOnline ?? "0");
        localStorage.setItem("BillPrintData", data.BillPrintData ?? "");
        localStorage.setItem("BillPrintDataDC", data.BillPrintDataDC ?? "");
        localStorage.setItem("CustomerReceiptPrintData", data.CustomerReceiptPrintData ?? "");
        localStorage.setItem("CustomerstmtPrintData", data.CustomerstmtPrintData ?? "");
        localStorage.setItem("SupplierstmtPrintData", data.SupplierstmtPrintData ?? "");
        localStorage.setItem("Companysetting", JSON.stringify(data.Comdata ?? []));
        localStorage.setItem("ProductId", data.ProductId ?? "");
        localStorage.setItem("TripExpenseId", data.TripExpenseId ?? "");
        localStorage.setItem("CustomerCreditId", data.CustomerCreditId ?? "");
        localStorage.setItem("AllowNegativeStock", comdata.NegativeStock == 1 ? "true" : "false");
     // }

      await CC.preloadProductListsForSession({
        Comid: String(user.Comid ?? "1"),
        MComid: String(user.MComid ?? user.Comid ?? "1"),
      });

      if (data.Otp === true && !localStorage.getItem("loginst")) {
        window.location.href = "/Login/OtpLoginIndex";
        return;
      }

      navigate("/dashboard");
    } catch (err) {
      console.error("Login error:", err);
      alert("Technical Fault Contact Software Vendor  !!!.");
    } finally {
      setLoading(false);
    }
  };

  const handleUsernameKeyDown = (e) => {
    if (e.key === "Enter") document.getElementById("Password")?.focus();
  };

  const handlePasswordKeyDown = (e) => {
    if (e.key === "Enter") handleLogin();
  };

  return (
    <div className="login-main">
      {loginFailedOpen && (
        <div style={CC.modalStyles.overlay}>
          <div style={CC.modalStyles.modal} role="dialog" aria-modal="true">
            <div style={CC.modalStyles.icon}>?</div>
            <p style={{ ...CC.modalStyles.msg, fontWeight: "700", marginBottom: "8px" }}>
              Login Failed
            </p>
            <p style={CC.modalStyles.msg}>
              Invalid User ID or Password. Please try again.
            </p>
            <div style={CC.modalStyles.btns}>
              <button
                autoFocus
                style={{ ...CC.modalStyles.btn, ...CC.modalStyles.yes }}
                onClick={closeLoginFailedPopup}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="login-right">
        <div className="login-right-container">
          <div className="login-logo">
            <img src={Logo} alt="Kassapos Logo" />
          </div>

          <div className="login-center">
            <h2>Welcome Back</h2>
            <p>Sign in to your account</p>

            <form onSubmit={(e) => e.preventDefault()}>
              <div className="input-group">
                <span className="input-icon">✉</span>
                <input
                  id="txtUsername"
                  type="text"
                  placeholder="Username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={handleUsernameKeyDown}
                  disabled={loading}
                  autoFocus
                />
              </div>

              <div className="pass-input-div input-group">
                <span className="input-icon">🔑</span>
                <input
                  id="Password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={handlePasswordKeyDown}
                  disabled={loading}
                />
                {showPassword ? (
                  <FaEyeSlash onClick={() => setShowPassword((v) => !v)} />
                ) : (
                  <FaEye onClick={() => setShowPassword((v) => !v)} />
                )}
              </div>

              <div className="login-center-buttons">
                <button
                  id="login-submit"
                  type="button"
                  onClick={handleLogin}
                  disabled={loading}
                >
                  {loading ? "Signing in..." : "Log In"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      <div className="login-left">
        <div className="login-left-overlay">
          <div className="login-left-brand">
            <div className="left-logo-ring">
              <span className="left-logo-letter">K</span>
            </div>
            <h1 className="left-brand-title">Kassapos</h1>
            <p className="left-brand-sub">Billing Solutions Platform</p>
          </div>

          <img src={Image} alt="Kassapos Illustration" className="login-hero-img" />

          <div className="left-floating-card left-card-1">
            <span className="lfc-icon">📦</span>
            <div>
              <div className="lfc-title">10,000+</div>
              <div className="lfc-sub">Invoices Generated</div>
            </div>
          </div>

          <div className="left-floating-card left-card-2">
            <span className="lfc-icon">🔒</span>
            <div>
              <div className="lfc-title">256-bit</div>
              <div className="lfc-sub">Encrypted &amp; Secure</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
