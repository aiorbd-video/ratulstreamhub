// ফাইল পাথ: app/api/admin/user/action/route.ts
import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import bcrypt from 'bcryptjs';

export const dynamic = 'force-dynamic';

// 🎯 ১. সব ইউজারের লিস্ট দেখার জন্য (GET Request)
export async function GET() {
  try {
    const client = await clientPromise;
    const db = client.db("all_in_one_reborn_db");
    
    const users = await db.collection("web_users")
      .find({})
      .sort({ createdAt: -1 })
      .toArray();

    return NextResponse.json({ success: true, users });
  } catch (error) {
    return NextResponse.json({ success: false, message: "সার্ভার এরর!" }, { status: 500 });
  }
}

// 🎯 ২. নতুন ইউজার তৈরি করার জন্য (POST Request)
export async function POST(req: Request) {
  try {
    const { phone, password, isPremium, premiumExpiry } = await req.json();

    if (!phone || !password) {
      return NextResponse.json({ success: false, message: "ফোন এবং পাসওয়ার্ড বাধ্যতামূলক!" }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db("all_in_one_reborn_db");

    const existingUser = await db.collection("web_users").findOne({ phone: phone.trim() });
    if (existingUser) {
      return NextResponse.json({ success: false, message: "এই ফোন নম্বরে অলরেডি অ্যাকাউন্ট আছে!" }, { status: 400 });
    }

    // 🔐 পাসওয়ার্ড হ্যাশ করা
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password.trim(), salt);

    const newUser = {
      phone: phone.trim(),
      password: hashedPassword,
      isPremium: isPremium ?? false,
      premiumExpiry: premiumExpiry ? new Date(premiumExpiry) : null,
      createdAt: new Date()
    };

    await db.collection("web_users").insertOne(newUser);
    return NextResponse.json({ success: true, message: "নতুন ইউজার সফলভাবে তৈরি হয়েছে!" });

  } catch (error) {
    return NextResponse.json({ success: false, message: "ইউজার তৈরি করতে সমস্যা হয়েছে!" }, { status: 500 });
  }
}

// 🎯 ৩. ইউজার এডিট এবং পাসওয়ার্ড রিসেট করার জন্য (PUT Request)
export async function PUT(req: Request) {
  try {
    const { id, phone, password, isPremium, premiumExpiry } = await req.json();

    if (!id) {
      return NextResponse.json({ success: false, message: "ইউজার আইডি প্রয়োজন!" }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db("all_in_one_reborn_db");
    
    const updateData: any = {
      phone: phone?.trim(),
      isPremium: isPremium,
      premiumExpiry: premiumExpiry ? new Date(premiumExpiry) : null,
      updatedAt: new Date()
    };

    // 🔐 পাসওয়ার্ড রিসেট ম্যাজিক: যদি অ্যাডমিন নতুন পাসওয়ার্ড ইনপুট দেয়, তবেই হ্যাশ হয়ে আপডেট হবে
    if (password && password.trim() !== "") {
      const salt = await bcrypt.genSalt(10);
      updateData.password = await bcrypt.hash(password.trim(), salt);
    }

    const result = await db.collection("web_users").updateOne(
      { _id: new ObjectId(id) },
      { $set: updateData }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ success: false, message: "ইউজার খুঁজে পাওয়া যায়নি!" }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: "ইউজার প্রোফাইল সফলভাবে আপডেট হয়েছে!" });

  } catch (error) {
    return NextResponse.json({ success: false, message: "আপডেট করতে সমস্যা হয়েছে!" }, { status: 500 });
  }
}

// 🎯 ৪. ইউজার ডিলিট করার জন্য (DELETE Request)
export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, message: "ইউজার আইডি প্রয়োজন!" }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db("all_in_one_reborn_db");

    const result = await db.collection("web_users").deleteOne({ _id: new ObjectId(id) });

    if (result.deletedCount === 0) {
      return NextResponse.json({ success: false, message: "ইউজার খুঁজে পাওয়া যায়নি!" }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: "ইউজার সফলভাবে ডিলিট করা হয়েছে!" });

  } catch (error) {
    return NextResponse.json({ success: false, message: "ডিলিট করতে সমস্যা হয়েছে!" }, { status: 500 });
  }
}
