import { prisma } from "@/lib/prisma";

export async function sendEmailWithRetry(
  emailFn: () => Promise<unknown>,
  maxRetries = 3
): Promise<void> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await emailFn();
      return;
    } catch (error) {
      if (attempt === maxRetries) {
        console.error(`EMAIL FAILED after ${maxRetries} attempts:`, error);
        await prisma.failedEmail
          .create({
            data: {
              error: String(error),
              attempt: maxRetries,
            },
          })
          .catch(() => {}); // silent if DB also fails
        return;
      }
      // Exponential backoff: 2s, 4s, 8s
      await new Promise((r) => setTimeout(r, Math.pow(2, attempt) * 1000));
    }
  }
}
