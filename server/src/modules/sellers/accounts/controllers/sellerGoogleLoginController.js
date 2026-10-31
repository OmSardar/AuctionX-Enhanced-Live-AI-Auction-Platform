const handleGoogleCallback = (req, res) => {
  if (!req.user || req.user.user?.status === "Suspended") {
    res.clearCookie("token", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
    });
    res.clearCookie("sellerToken", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
    });

    const clientURL = process.env.CLIENT_URL;
    const reason = req.user?.user?.suspensionReason || "Account suspended by administrator";
    if (clientURL) {
      return res.redirect(`${clientURL}/login?error=account_suspended&reason=${encodeURIComponent(reason)}`);
    }
    return res.status(403).json({
      success: false,
      message: `Account has been suspended: ${reason}`,
      status: "Suspended",
    });
  }

  const { token, user } = req.user;

  res.cookie("token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 30 * 24 * 60 * 60 * 1000,
  });

  const profilePic = JSON.stringify(user.profilePic);

  const clientURL = process.env.CLIENT_URL;

  res.redirect(
    `${clientURL}/login?` +
      `id=${user._id}&` + // Critical: Include user ID
      `name=${encodeURIComponent(user.name)}&` +
      `email=${encodeURIComponent(user.email)}&` +
      `profilePic=${encodeURIComponent(profilePic)}&` +
      `role=${user.role}&` +
      `isNewUser=${user.isNewUser}&` +
      `verified=${user.isVerified ? "true" : "false"}`
  );
};

module.exports = {
  handleGoogleCallback,
};
