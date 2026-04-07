import nodemailer from "nodemailer";

export async function sendEmail(
  opts: {
    host: string;
    port: number;
    user: string;
    pass: string;
    from: string;
    to: string;
  },
  subject: string,
  text: string
): Promise<boolean> {
  try {
    const transporter = nodemailer.createTransport({
      host: opts.host,
      port: opts.port,
      auth: { user: opts.user, pass: opts.pass },
    });
    await transporter.sendMail({ from: opts.from, to: opts.to, subject, text });
    return true;
  } catch {
    return false;
  }
}
