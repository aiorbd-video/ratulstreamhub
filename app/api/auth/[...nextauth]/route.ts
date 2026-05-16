// ফাইল পাথ: app/api/auth/[...nextauth]/route.ts
import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import clientPromise from "@/lib/mongodb";
import bcrypt from "bcryptjs";
import { ObjectId } from "mongodb"; // 🎯 ObjectId ইমপোর্ট করা হলো

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

        const user = await db.collection("web_users").findOne({ phone: credentials.phone });
        if (!user) {
          throw new Error("এই নাম্বারে কোনো অ্যাকাউন্ট পাওয়া যায়নি!");
        }

        const isPasswordCorrect = await bcrypt.compare(credentials.password, user.password);
        if (!isPasswordCorrect) {
          throw new Error("পাসওয়ার্ড ভুল হয়েছে!");
        }

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
      }
      
      // 🎯 ম্যাজিক ফিক্স: পেজ রিফ্রেশ করলে কুকি রিড করার পাশাপাশি ডাটাবেস থেকে একদম লাইভ স্ট্যাটাস তুলে আনবে
      if (token.id) {
        try {
          const client = await clientPromise;
          const db = client.db("all_in_one_reborn_db");
          const dbUser = await db.collection("web_users").findOne({ _id: new ObjectId(token.id as string) });
          if (dbUser) {
            token.isPremium = dbUser.isPremium; // ডাটাবেসের তাজা ডাটা টোকেনে সেট হলো
          }
        } catch (error) {
          console.error("Error fetching user status in JWT:", error);
        }
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
    signIn: '/login',
  },
  secret: process.env.NEXTAUTH_SECRET,
});

export { handler as GET, handler as POST };
