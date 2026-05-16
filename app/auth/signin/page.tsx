'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'

export default function SignIn() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const result = await signIn('credentials', {
      redirect: false,
      username,
      password,
    })
    if (result?.error) {
      setError('Invalid username or password')
    } else {
      // Redirect to the home page or a protected route
      window.location.href = '/'
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
      <div className="bg-slate-900/80 backdrop-blur-sm border border-slate-800/80 rounded-2xl p-8 max-w-sm w-full">
        <h1 className="text-2xl font-bold text-center mb-4">Sign In</h1>
        {error && <p className="text-red-500 text-center mb-4">{error}</p>}
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block mb-2 text-sm font-bold text-slate-400" htmlFor="username">
              Username
            </label>
            <input
              className="w-full px-4 py-2.5 rounded-xl bg-slate-800/80 border border-slate-700/50 text-white placeholder-slate-400 focus:outline-none focus:border-red-500 transition-all text-sm backdrop-blur-sm"
              type="text"
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>
          <div className="mb-6">
            <label className="block mb-2 text-sm font-bold text-slate-400" htmlFor="password">
              Password
            </label>
            <input
              className="w-full px-4 py-2.5 rounded-xl bg-slate-800/80 border border-slate-700/50 text-white placeholder-slate-400 focus:outline-none focus:border-red-500 transition-all text-sm backdrop-blur-sm"
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <button
            className="w-full text-center bg-slate-850 hover:bg-gradient-to-r hover:from-red-600 hover:to-orange-600 text-white text-sm font-bold py-2.5 px-4 rounded-xl transition-all duration-300 border border-slate-700 group-hover:border-transparent"
            type="submit"
          >
            Sign In
          </button>
        </form>
      </div>
    </div>
  )
}
