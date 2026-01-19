import { NextResponse } from 'next/server';

export async function POST() {
  const response = NextResponse.json({ success: true });

  // Удаляем куку с ID пользователя
  response.cookies.delete('user_id');

  return response;
}
