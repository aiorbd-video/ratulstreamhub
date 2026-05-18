// ফাইল পাথ: app/api/auth/[...nextauth]/route.ts
import NextAuth, { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import clientPromise from "@/lib/mongodb";
import bcrypt from "bcryptjs";

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        phone: { label: "Phone", type: "text" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.phone || !credentials?.password) {
          throw new Error("ফোন নাম্বার এবং পাসওয়ার্ড দিন");
        }
        
        const client = await clientPromise;
        const db = client.db("all_in_one_reborn_db");
        const user = await db.collection("web_users").findOne({ phone: credentials.phone });

        if (!user) {
          throw new Error("ইউজার পাওয়া যায়নি");
        }

        // Bcrypt দিয়ে পাসওয়ার্ড চেক করা
        const isValid = await bcrypt.compare(credentials.password, user.password);
        if (!isValid) {
          throw new Error("পাসওয়ার্ড ভুল হয়েছে");
        }

        return {
          id: user._id.toString(),
          name: user.name || user.phone,
          phone: user.phone,
          isPremium: user.isPremium,
        };
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token._id = user.id; // ডাটাবেস আইডি টোকেনে সেভ হলো
        token.isPremium = (user as any).isPremium;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id;
        (session.user as any)._id = token._id; // টোকেন থেকে আইডি সেশনে (ফ্রন্টএন্ডে) গেল
        (session.user as any).isPremium = token.isPremium;
      }
      return session;
    }
  },
  pages: {
    signIn: '/login', // আপনার লগিন পেজের লিংক
  },
  session: {
    strategy: "jwt",
  },
  secret: process.env.NEXTAUTH_SECRET || "your_super_secret_key_all_in_one_reborn",
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
