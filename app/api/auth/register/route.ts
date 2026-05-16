import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import bcrypt from 'bcryptjs';

export async function POST(req: Request) {
  try {
    const { name, phone, password } = await req.json();

    if (!name || !phone || !password) {
      return NextResponse.json({ message: "সবগুলো ঘর পূরণ করা বাধ্যতামূলক!" }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db("all_in_one_reborn_db");

    // চেক করা হচ্ছে এই নাম্বারে আগে থেকেই অ্যাকাউন্ট আছে কি না
    const existingUser = await db.collection("web_users").findOne({ phone });
    if (existingUser) {
      return NextResponse.json({ message: "এই নাম্বারে আগে থেকেই একটি অ্যাকাউন্ট আছে!" }, { status: 400 });
    }

    // পাসওয়ার্ড হ্যাশ (সিকিউর) করা
    const hashedPassword = await bcrypt.hash(password, 10);

    // নতুন ইউজার ডাটাবেসে সেভ করা
    const result = await db.collection("web_users").insertOne({
      name,
      phone,
      password: hashedPassword,
      isPremium: false, // শুরুতে সবাই ফ্রি ইউজার থাকবে
      premiumExpiry: null,
      createdAt: new Date(),
    });

    return NextResponse.json({ message: "অ্যাকাউন্ট সফলভাবে তৈরি হয়েছে!", success: true }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ message: "সার্ভারে কোনো সমস্যা হয়েছে!" }, { status: 500 });
  }
}
