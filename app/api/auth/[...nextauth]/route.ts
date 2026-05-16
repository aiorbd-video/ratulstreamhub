import NextAuth from "next-auth";
import CredentialsProvider from "next-authprovidersoviders/credentials";
import clientPromise from "@/lib/mongodb";
import bcrypt from "bcryptjs";

const handler = NextAuth({
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        phone: { label: "Phone", type: "text", placeholder: "017..." },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.phone || !credentials?.password) {
          throw new Error("নাম্বার এবং পাসওয়ার্ড দিন!");
        }

        const client = await clientPromise;
        const db = client.db("all_in_one_reborn_db");

        // ডাটাবেস থেকে ইউজার খোঁজা
        const user = await db.collection("web_users").findOne({ phone: credentials.phone });
        if (!user) {
          throw new Error("এই নাম্বারে কোনো অ্যাকাউন্ট পাওয়া যায়নি!");
        }

        // পাসওয়ার্ড মেলানো
        const isPasswordCorrect = await bcrypt.compare(credentials.password, user.password);
        if (!isPasswordCorrect) {
          throw new Error("পাসওয়ার্ড ভুল হয়েছে!");
        }

        // লগিন সফল হলে ইউজারের এই ডাটাগুলো সেশনে সেভ থাকবে
        return {
          id: user._id.toString(),
          name: user.name,
          phone: user.phone,
          isPremium: user.isPremium,
        } as any;
      }
    })
  ],
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.phone = (user as any).phone;
        token.isPremium = (user as any).isPremium;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id;
        (session.user as any).phone = token.phone;
        (session.user as any).isPremium = token.isPremium;
      }
      return session;
    }
  },
  pages: {
    signIn: '/login', // আমাদের কাস্টম লগিন পেজ (পরে বানাবো)
  },
  secret: process.env.NEXTAUTH_SECRET, // সিকিউরিটি কী (Key)
});

export { handler as GET, handler as POST };
