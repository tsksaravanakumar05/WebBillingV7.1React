import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Save, XCircle, X } from "lucide-react";
import "../companycreation.css";

// ---------------------------------------------------------------
// CONFIG - update these to match your real server
// clsOnlineApi.cs -> OnlineURL = "http://13.200.71.164:9001/api/"  (Live)
//                  -> OnlineURL = "http://localhost:64215/api/"     (Local, commented)
// InsertCompany   = "/loginApp/InsertCompany"
// SMS API (from frmMasterSetting.cs -> MSgURL)
// ---------------------------------------------------------------
const API_BASE = "http://localhost:64215/api/loginApp"; // change to live URL when needed
const INSERT_COMPANY_URL = `${API_BASE}/InsertCompany`;

// NOTE: this is a plain GET to a third-party SMS gateway, same as the
// C# WebClient.DownloadString(...) call. Browsers enforce CORS, so if
// this gateway doesn't send CORS headers, the request may be blocked
// when called directly from the browser. If that happens, proxy this
// call through your own backend (e.g. an endpoint like
// /api/loginApp/SendOtp?mobile=...&msg=...) instead of hitting it here.
const SMS_BASE_URL =
  "http://bulksms.kassapos.in/api/smsapi?key=7d6c37f05d51061ba55560dd8eb04cbf&route=2&sender=KASPOS&number=MobileNo_Data&templateid=1707161829740183971&sms=Msg_Data";

export default function CompanyCreation() {
  const navigate = useNavigate();

  // "form"  -> user is entering shop details
  // "otp"   -> waiting for user to enter the OTP that was sent
  const [step, setStep] = useState("form");

  const [saving, setSaving] = useState(false); // used for both "sending OTP" and "verifying+inserting"
  const [form, setForm] = useState({
    shopName: "",
    mobileNo: "",
    password: "123456",
  });

  // OTP related state
  const [generatedOtp, setGeneratedOtp] = useState(null);
  const [enteredOtp, setEnteredOtp] = useState("");
  const [otpError, setOtpError] = useState("");

  const handleChange = (field) => (e) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const validateForm = () => {
    if (!form.shopName.trim()) {
      alert("Enter the ShopName !!!.");
      return false;
    }
    if (!form.mobileNo.trim()) {
      alert("Enter the MobileNo !!!.");
      return false;
    }
    if (form.mobileNo.trim().length !== 10) {
      alert("Invaild the MobileNo !!!.");
      return false;
    }
    if (!form.password.trim()) {
      alert("Enter the Password !!!.");
      return false;
    }
    return true;
  };

  // ---------------------------------------------------------------
  // Step 1: Generate OTP + send SMS (equivalent to the top half of
  // C# SaveCompany(): building `message`, hitting MSgURL, then
  // popping the OTP input box).
  // ---------------------------------------------------------------
  const generateAndSendOtp = async () => {
    const otp = Math.floor(1000 + Math.random() * 8999); // matches rnd.Next(1001, 9999) range
    const refNo = "KAS" + Math.floor(100 + Math.random() * 899);
    const message = `OTP No :${otp}\n RefNo : ${refNo}\nClientName: ${form.shopName} Thank you.KASPOS`;

    const url = SMS_BASE_URL.replace("MobileNo_Data", form.mobileNo).replace(
      "Msg_Data",
      encodeURIComponent(message)
    );

    // mode: "no-cors" is used because bulksms.kassapos.in doesn't send an
    // Access-Control-Allow-Origin header. This still sends the request
    // (SMS still goes out) but the browser won't let us read the response,
    // and won't throw a CORS error either. We don't use the response value
    // anyway, so this is safe here.
    await fetch(url, { mode: "no-cors" });
    setGeneratedOtp(otp);
  };

  // Save button on the details screen: validate -> send OTP -> move to OTP step
  const handleSave = async () => {
    if (!validateForm()) return;

    setSaving(true);
    try {
      await generateAndSendOtp();
      setOtpError("");
      setEnteredOtp("");
      setStep("otp");
    } catch (err) {
      console.error("Send OTP failed:", err);
      alert("Could not send OTP. Please check your connection and try again.");
    } finally {
      setSaving(false);
    }
  };

  // ---------------------------------------------------------------
  // Step 2: Verify OTP, then InsertCompany (equivalent to the OTP-match
  // branch in C# SaveCompany() -> unchanged from your working version).
  // ---------------------------------------------------------------
  const insertCompany = async () => {
    const companyPayload = [
      {
        CompanyName: form.shopName,
        MobileNo: form.mobileNo,
        Username: form.mobileNo,
        EmailId: form.mobileNo,
        Package: "Premium",
        Password: form.password,
        Address1: "",
        Address2: "",
        City: "",
        GSTINNo: "",
      },
    ];

    const res = await fetch(INSERT_COMPANY_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ApiType: "1",
      },
      body: JSON.stringify(companyPayload),
    });

    let ro = null;
    try {
      ro = await res.json(); // ResponseViewModel { IsSuccess, StatusCode, Message, Data1, Data2 }
    } catch (parseErr) {
      console.error("InsertCompany: response was not valid JSON", parseErr);
    }

    if (!res.ok && !ro) {
      console.error("InsertCompany failed:", res.status, res.statusText);
      alert(`Server error (${res.status}). Check API_BASE URL / server is running / CORS.`);
      return;
    }

    if (ro && ro.IsSuccess === true) {
      alert("Company Create Successfully !!!.");
      navigate("/", { state: { mobileNo: form.mobileNo, password: form.password } });
    } else if (ro && ro.StatusCode === 404) {
      alert("MobileNo Already Exits !!!.");
    } else {
      alert((ro && ro.Message) || "Something went wrong. Please try again.");
    }
  };

  const handleVerifyOtp = async () => {
    if (!enteredOtp.trim()) {
      setOtpError("Enter the OTP !!!.");
      return;
    }
    if (Number(enteredOtp) !== Number(generatedOtp)) {
      setOtpError("Invaild OTP !!!.");
      return;
    }

    setOtpError("");
    setSaving(true);
    try {
      await insertCompany();
    } catch (err) {
      console.error("InsertCompany network error:", err);
      alert("Server error, try again. (Check console for details, and confirm API_BASE is correct + backend is running.)");
    } finally {
      setSaving(false);
    }
  };

  const handleResendOtp = async () => {
    setSaving(true);
    try {
      await generateAndSendOtp();
      setOtpError("");
      setEnteredOtp("");
    } catch (err) {
      console.error("Resend OTP failed:", err);
      alert("Could not resend OTP. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleBackToForm = () => {
    setStep("form");
    setOtpError("");
    setEnteredOtp("");
  };

  const handleCancel = () => navigate("/login");

  const handleShopKeyDown = (e) => {
    if (e.key === "Enter") document.getElementById("cc-mobileno")?.focus();
  };
  const handleMobileKeyDown = (e) => {
    if (e.key === "Enter") document.getElementById("cc-password")?.focus();
  };
  const handlePasswordKeyDown = (e) => {
    if (e.key === "Enter") handleSave();
  };
  const handleOtpKeyDown = (e) => {
    if (e.key === "Enter") handleVerifyOtp();
  };

  return (
    <div className="cc-overlay">
      <div className="cc-modal">
        {/* Title Bar */}
        <div className="cc-titlebar">
          <span>Company Creation</span>
          <button
            onClick={handleCancel}
            className="cc-close-btn"
            aria-label="Close"
            type="button"
          >
            <X size={14} strokeWidth={3} />
          </button>
        </div>

        {/* Body */}
        <div className="cc-body">
          {step === "form" && (
            <>
              <h1 className="cc-heading">Company Creation</h1>

              <fieldset className="cc-fieldset">
                <legend>Company Details</legend>

                <div className="cc-field-row">
                  <label htmlFor="cc-shopname">Shop Name</label>
                  <input
                    id="cc-shopname"
                    type="text"
                    value={form.shopName}
                    onChange={handleChange("shopName")}
                    onKeyDown={handleShopKeyDown}
                    disabled={saving}
                    autoFocus
                  />
                </div>

                <div className="cc-field-row">
                  <label htmlFor="cc-mobileno">Mobile No</label>
                  <input
                    id="cc-mobileno"
                    type="tel"
                    inputMode="numeric"
                    value={form.mobileNo}
                    onChange={handleChange("mobileNo")}
                    onKeyDown={handleMobileKeyDown}
                    disabled={saving}
                    maxLength={10}
                  />
                </div>

                <div className="cc-field-row">
                  <label htmlFor="cc-password">Password</label>
                  <input
                    id="cc-password"
                    type="password"
                    value={form.password}
                    onChange={handleChange("password")}
                    onKeyDown={handlePasswordKeyDown}
                    disabled={saving}
                  />
                </div>
              </fieldset>

              {/* Buttons */}
              <div className="cc-actions">
                <button
                  className="cc-btn"
                  onClick={handleSave}
                  disabled={saving}
                  type="button"
                >
                  <Save size={16} className="cc-icon-save" />
                  {saving ? "Sending OTP..." : "Save"}
                </button>
                <button
                  className="cc-btn"
                  onClick={handleCancel}
                  disabled={saving}
                  type="button"
                >
                  <XCircle size={16} className="cc-icon-cancel" />
                  Cancel
                </button>
              </div>

              {/* Existing Login link */}
              <div className="cc-existing-login">
                <a
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    navigate("/login");
                  }}
                >
                  Existing Login ?
                </a>
              </div>
            </>
          )}

          {step === "otp" && (
            <>
              <h1 className="cc-heading">Enter OTP</h1>

              <fieldset className="cc-fieldset">
                <legend>OTP Verification</legend>

                <div className="cc-field-row">
                  <label htmlFor="cc-otp">OTP sent to {form.mobileNo}</label>
                  <input
                    id="cc-otp"
                    type="text"
                    inputMode="numeric"
                    value={enteredOtp}
                    onChange={(e) => setEnteredOtp(e.target.value)}
                    onKeyDown={handleOtpKeyDown}
                    disabled={saving}
                    autoFocus
                    maxLength={4}
                  />
                </div>

                {otpError && (
                  <div className="cc-field-row" style={{ color: "red" }}>
                    {otpError}
                  </div>
                )}
              </fieldset>

              <div className="cc-actions">
                <button
                  className="cc-btn"
                  onClick={handleVerifyOtp}
                  disabled={saving}
                  type="button"
                >
                  <Save size={16} className="cc-icon-save" />
                  {saving ? "Verifying..." : "Verify & Create"}
                </button>
                <button
                  className="cc-btn"
                  onClick={handleResendOtp}
                  disabled={saving}
                  type="button"
                >
                  Resend OTP
                </button>
                <button
                  className="cc-btn"
                  onClick={handleBackToForm}
                  disabled={saving}
                  type="button"
                >
                  <XCircle size={16} className="cc-icon-cancel" />
                  Back
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}