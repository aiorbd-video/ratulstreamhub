// ফাইল পাথ: app/api/admin/users/action/route.ts
import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import bcrypt from 'bcryptjs'; // 🎯 পাসওয়ার্ড হ্যাশ করার জন্য bcrypt ইমপোর্ট করা হলো

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action, userId } = body;

    if (!userId) {
      return NextResponse.json({ success: false, message: "ইউজার আইডি পাওয়া যায়নি!" }, { status: 400 });
    }

    // 🎯 নিরাপত্তা ফিক্স: আইডিটি বৈধ ObjectId কি না তা ভেরিফাই করা
    let objId;
    try {
      objId = new ObjectId(userId);
    } catch (e) {
      return NextResponse.json({ success: false, message: "অবৈধ ইউজার আইডি ফরম্যাট!" }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db("all_in_one_reborn_db");

    // 🗑️ ১. ইউজার ডিলিট করার অ্যাকশন
    if (action === 'delete') {
      const result = await db.collection("web_users").deleteOne({ _id: objId });
      if (result.deletedCount === 0) {
        return NextResponse.json({ success: false, message: "এই ইউজার ডাটাবেসে নেই!" }, { status: 404 });
      }
      return NextResponse.json({ success: true, message: "ইউজারকে সফলভাবে ডিলিট করা হয়েছে!" });
    }

    // ✏️ ২. ইউজার সাধারণ তথ্য এবং পাসওয়ার্ড এডিট করার অ্যাকশন (নতুন যুক্ত করা হলো)
    if (action === 'edit_user' || action === 'update') {
      const { name, phone, password } = body;
      const updateData: any = {};

      if (name !== undefined) updateData.name = name;
      if (phone !== undefined) updateData.phone = phone;

      // 🔐 পাসওয়ার্ড ইডিট ফিক্স: যদি নতুন পাসওয়ার্ড দেওয়া হয় তবেই হ্যাশ হবে
      if (password && password.trim() !== '') {
        const salt = await bcrypt.genSalt(10);
        updateData.password = await bcrypt.hash(password, salt);
      }

      const result = await db.collection("web_users").updateOne(
        { _id: objId },
        { $set: updateData }
      );

      return NextResponse.json({ success: true, message: "ইউজারের তথ্য সফলভাবে আপডেট হয়েছে!" });
    }

    // 🌟 ৩. প্রিমিয়াম স্ট্যাটাস পরিবর্তন ও রিভোক (Toggle/Revoke Premium)
    if (action === 'toggle_premium') {
      // 🎯 স্ট্রিং ট্র্যাপ ফিক্স: স্ট্রিং বা বুলিয়ান যাই আসুক সঠিকভাবে কনভার্ট করবে
      const premiumStatus = body.premiumStatus === true || body.premiumStatus === 'true';
      let updateData: any = { isPremium: premiumStatus };
      
      if (premiumStatus) {
        // ফ্রন্টএন্ড থেকে duration (দিন) পাঠালে সেটা সেট হবে, নয়তো ডিফল্ট ৩০ দিন
        const days = body.duration ? parseInt(body.duration) : 30;
        let expiry = new Date();
        expiry.setDate(expiry.getDate() + days);
        updateData.premiumExpiry = expiry;
      } else {
        // 🚫 প্রিমিয়াম রিকোভ/Revoke করলে মেয়াদ সম্পূর্ণ null (মুছে) হয়ে যাবে
        updateData.premiumExpiry = null;
      }

      await db.collection("web_users").updateOne(
        { _id: objId },
        { $set: updateData }
      );
      
      return NextResponse.json({ 
        success: true, 
        message: premiumStatus ? "প্রিমিয়াম সফলভাবে অন করা হয়েছে!" : "প্রিমিয়াম সফলভাবে বন্ধ করা হয়েছে!" 
      });
    }

    return NextResponse.json({ success: false, message: "অবৈধ অ্যাকশন!" }, { status: 400 });
  } catch (error) {
    console.error("Admin Action Error:", error);
    return NextResponse.json({ success: false, message: "সার্ভার এরর! আবার চেষ্টা করুন।" }, { status: 500 });
  }
}
