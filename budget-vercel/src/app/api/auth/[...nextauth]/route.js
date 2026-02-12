import NextAuth from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';

// Your email - only this account can access the app
const ALLOWED_EMAIL = process.env.ALLOWED_EMAIL;

const handler = NextAuth({
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  ],
  callbacks: {
    async signIn({ user }) {
      // Only allow your specific email
      if (ALLOWED_EMAIL && user.email !== ALLOWED_EMAIL) {
        return false;
      }
      return true;
    },
    async session({ session, token }) {
      return session;
    },
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
});

export { handler as GET, handler as POST };
