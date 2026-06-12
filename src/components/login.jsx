import React, { useState } from "react";
import "../index.css";
import { useNavigate } from "react-router-dom";
import Image from "../assets/image.png";
import Logo from "../assets/logo.png";
import Logo from "../assets/logo.png";
import { FaEye, FaEyeSlash } from "react-icons/fa";

// ─────────────────────────────────────────────────────────────────────────────
// WHY QUERY STRING — NOT JSON BODY
// ─────────────────────────────────────────────────────────────────────────────
// C# method signature:
//   public HttpResponseMessage LoginSuccess(string Userid, string Pwd, string olduserid)
//
// ASP.NET Web API binds primitive types (string, int, etc.) from the QUERY STRING,
// NOT from the request body. Sending JSON body causes "No action was found" 404
// because the parameter binding fails and the route doesn't match.
//
// Correct URL:
//   POST /api/loginApp/LoginSuccess?Userid=xxx&Pwd=yyy&olduserid=zzz
//   (no Content-Type, no body)
// ─────────────────────────────────────────────────────────────────────────────

const Login = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [email,        setEmail]        = useState("");
  const [password,     setPassword]     = useState("");
  const [loading,      setLoading]      = useState(false);
  const navigate = useNavigate();

  const handleLogin = async () => {
    if (!email && !password) { alert("Please Enter the Username & Password !!!"); return; }
    if (!email)               { alert("Please Enter the Username !!!");            return; }
    if (!password)            { alert("Please Enter the Password !!!");            return; }

    const olduserid = localStorage.getItem("userid") || "";
localStorage.removeItem("lastBillNo");
localStorage.removeItem("lastBillAmt");
    setLoading(true);
    try {
      // ── Build query string — matches C# primitive parameters ──────────────
      // LoginSuccess(string Userid, string Pwd, string olduserid)
      const qs = new URLSearchParams({
        Userid:    email,
        Pwd:       password,
        olduserid: olduserid,
      }).toString();

      // Vite proxy: /Login/LoginSuccess → http://localhost:64215/api/loginApp/LoginSuccess
      const res = await fetch(`/Login/webLoginSuccess?${qs}`, {
        method: "POST",
        // No Content-Type, no body — backend reads primitives from query string
      });

      if (!res.ok) {
        const txt = await res.text();
        console.error(`[Login] HTTP ${res.status}:`, txt);
        alert(`Server error (${res.status}) — see console for details.`);
        return;
      }

      const data = await res.json();
      console.log("Login raw response:", data);

      // Support both shapes: { ok, data } and { IsSuccess, Data1 }
      const success = data.ok === true || data.IsSuccess === true;

      if (success) {
        const gedata = data.data ?? data.Data1;

        if (!gedata || !gedata[0]) {
          alert("Login failed: no user data returned.");
          return;
        }
        const user = gedata[0];


        localStorage.setItem("token",      data.Data14 || data.Token   || ""); //session-active
        localStorage.setItem("Profile",    data.Data15 || data.Profile || "Admin");
        localStorage.setItem("LoginCheck", "1");

        // ── User identity ─────────────────────────────────────────────────
        localStorage.setItem("userid",      String(user.UserId));
        localStorage.setItem("username",    email);
        localStorage.setItem("priv",        user.Priv        ?? "");
        localStorage.setItem("Comid",       String(user.Comid  ?? "1"));
        localStorage.setItem("MComid",      String(user.MComid ?? user.Comid ?? "1"));
        localStorage.setItem("HoCompany",   user.Comid == user.MComid ? "1" : "0");
        localStorage.setItem("CompanyName", user.CompanyName ?? "");
        localStorage.setItem("popupalert",  "1");
        localStorage.setItem("LoginCount",  "0");
        sessionStorage.setItem("home",      "1");

        // ── IdComList — plain comma-separated string (NOT JSON.stringify) ──
        // ItemMaster reads with getStr("IdComList") = plain localStorage.getItem
        // DeleteItemMaster backend reads: Request.Headers.GetValues("IdComList")
        const rawIdComList = data.objComIdList;
        if (Array.isArray(rawIdComList)) {
          localStorage.setItem("IdComList",
            rawIdComList.map(o => o.Id ?? o.Comid ?? String(o)).join(",")
          );
        } else if (typeof rawIdComList === "string") {
          localStorage.setItem("IdComList", rawIdComList);
        } else {
          localStorage.setItem("IdComList", String(user.Comid ?? "1"));
        }

        // ── Full settings — only on new/changed user ───────────────────────
        if (olduserid !== String(user.UserId)) {
          const comdata  = data.Comdata?.[0]  || {};
          const maindata = data.Maindata?.[0] || {};

          localStorage.setItem("Address",
            `${comdata.Address1 || ""} ${comdata.Address2 || ""} ${comdata.City || ""}`.trim()
          );
          localStorage.setItem("Phone", `Phone No :${comdata.Phone || ""}`);

          localStorage.setItem("CashierRefid",             data.CashierId               ?? "");
          localStorage.setItem("parentcashid",             data.Cashid                  ?? "");
          localStorage.setItem("CreditId",                 data.CreditId                ?? "");
          localStorage.setItem("CustomerCashid",           data.CustomerCashId          ?? "");
          localStorage.setItem("menulistload",             data.Menulist                ?? "");
          localStorage.setItem("BillPrintData",            data.BillPrintData           ?? "");
          localStorage.setItem("BillPrintDataDC",          data.BillPrintDataDC         ?? "");
          localStorage.setItem("CustomerReceiptPrintData", data.CustomerReceiptPrintData ?? "");

          // menulist → JSON array, parsed by getLocal("menulist") in ItemMaster
          localStorage.setItem("menulist", JSON.stringify(data.Menudata ?? []));

          localStorage.setItem("MirrorTableOnline", maindata.MirrorTableOnline     ?? "0");
          localStorage.setItem("MirrorTable",       maindata.MirrorTableOnline     ?? "0");
          localStorage.setItem("CommonCompany",     maindata.CommonCompany         ?? "0");
          localStorage.setItem("SupplierCommon",    maindata.SupplierCommonCompany ?? "0");
          localStorage.setItem("Tamil",             maindata.ProductNameTamil      ?? "0");

          localStorage.setItem("AllowNegativeStock",
            comdata.NegativeStock == 1 ? "true" : "false"
          );

          // Companysetting / Mainsetting → JSON arrays, parsed by getLocal()
          localStorage.setItem("Companysetting", JSON.stringify(data.Comdata  ?? []));
          localStorage.setItem("Mainsetting",    JSON.stringify(data.Maindata ?? []));
          console.log(data.Maindata?? []);
        }

        console.log("✅ Login OK | userid:", user.UserId,
                    "| Comid:", user.Comid,
                    "| token:", String(data.Data14 ?? "").slice(0, 20));

        navigate("/dashboard");

      } else {
        alert(data.message ?? data.Message ?? "Invalid Username or Password");
      }

    } catch (err) {
      console.error("Login error:", err);
      alert("Technical Fault Contact Software Vendor !!!.");
    } finally {
      setLoading(false);
    }
  };

  const handleUsernameKeyDown = e => { if (e.key === "Enter") document.getElementById("Password")?.focus(); };
  const handlePasswordKeyDown = e => { if (e.key === "Enter") handleLogin(); };

  return (
    <div className="login-main">

      {/* ── LEFT: FORM ── */}
      <div className="login-right">
        <div className="login-right-container">

          <div className="login-logo">
            <img src={Logo} alt="Kassapos Logo" />
          </div>

          <div className="login-center">
            <h2>Welcome Back</h2>
            <p>Sign in to your account</p>

            <form onSubmit={e => e.preventDefault()}>

              <div className="input-group">
                <span className="input-icon">✉</span>
                <input
                  id="txtUsername"
                  type="text"
                  placeholder="Username"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
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
                  onChange={e => setPassword(e.target.value)}
                  onKeyDown={handlePasswordKeyDown}
                  disabled={loading}
                />
                {showPassword
                  ? <FaEyeSlash onClick={() => setShowPassword(v => !v)} />
                  : <FaEye      onClick={() => setShowPassword(v => !v)} />
                }
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

      {/* ── RIGHT: IMAGE ── */}
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