import dotenv from "dotenv";
dotenv.config({ path: ".env" });
import { sendEmail } from "./emailService.js";
import { logInfo, logError } from "./logger.js";

(async () => {
  try {
    const result = await sendEmail({
      to: "actual_test@gmail.com",  // Use real email
      subject: "Email Service Test ✅",
      html: "<h1>Email service is working!</h1>",
    });
    
    if (result) {
      logInfo("✅ Test email sent successfully");
    } else {
      logError("❌ Test email failed");
    }
  } catch (error) {
    logError("❌ Test error:", error);
  }
})();