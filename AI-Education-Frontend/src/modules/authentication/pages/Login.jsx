import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuth from '../../../hooks/useAuth';
import AuthHeader from '../components/AuthHeader';
import AuthHeroPanel from '../components/AuthHeroPanel';

const Login = () => {
  const navigate = useNavigate();
  const { login, setUser } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e) => {
    if (e) e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const data = await login({ email, password, rememberMe });
      setUser(data.user);
      navigate('/');
    } catch (err) {
      const backendMessage = err.response?.data?.message;
      setError(backendMessage || 'Unable to sign in. Please check your credentials and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F7F3EA] dark:bg-[#0b1324] text-[#17212B] dark:text-slate-100 transition-colors">
      <AuthHeader />

      <main className="flex-grow flex items-center justify-center py-8 px-4 sm:px-6 md:px-8">
        <div className="w-full space-y-8">
          <div className="flex flex-col lg:flex-row gap-8 lg:gap-12 items-stretch">
            
            {/* Left Hero Illustration & Value Props (Auto-switches Girl & Boy every 3 sec) */}
            <AuthHeroPanel />

            {/* Right Card Container */}
            <div className="w-full lg:w-1/2 flex flex-col justify-center space-y-4">
              
              {/* Main Auth Form Card */}
              <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 shadow-xl border border-slate-200/80 dark:border-slate-800 space-y-6">
                
                {/* Segmented Control Toggle Bar */}
                <div className="bg-slate-100 dark:bg-slate-800/80 p-1.5 rounded-2xl flex items-center">
                  <button
                    type="button"
                    className="w-1/2 py-2.5 rounded-xl font-extrabold text-xs sm:text-sm transition-all shadow-xs bg-[#064e3b] text-white text-center cursor-pointer"
                  >
                    Sign In
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate('/signup')}
                    className="w-1/2 py-2.5 rounded-xl font-extrabold text-xs sm:text-sm transition-all text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white text-center cursor-pointer"
                  >
                    Sign Up
                  </button>
                </div>

                {/* Header Title */}
                <div>
                  <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                    Welcome Back
                  </h2>
                  <p className="text-slate-500 dark:text-slate-400 font-medium text-xs sm:text-sm mt-1">
                    Sign in with your email to continue to StudySpace.
                  </p>
                </div>

                {/* Error Banner */}
                {error && (
                  <div className="p-3.5 bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 font-bold rounded-2xl text-xs sm:text-sm border border-rose-200 dark:border-rose-900/60 text-center">
                    {error}
                  </div>
                )}

                {/* Sign In Form */}
                <form className="space-y-4" onSubmit={handleLogin}>
                  {/* Email Field */}
                  <div>
                    <label className="block text-xs font-extrabold text-slate-700 dark:text-slate-300 mb-1.5">
                      Email Address
                    </label>
                    <div className="relative flex items-center">
                      <span className="material-symbols-outlined absolute left-3.5 text-slate-400 text-[20px] pointer-events-none">
                        mail
                      </span>
                      <input
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        type="email"
                        placeholder="harshitasurana2005@gmail.com"
                        className="w-full pl-11 pr-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/60 text-slate-900 dark:text-white font-medium text-sm focus:outline-none focus:border-[#064e3b] focus:ring-2 focus:ring-[#064e3b]/20 transition-all"
                      />
                    </div>
                  </div>

                  {/* Password Field */}
                  <div>
                    <label className="block text-xs font-extrabold text-slate-700 dark:text-slate-300 mb-1.5">
                      Password
                    </label>
                    <div className="relative flex items-center">
                      <span className="material-symbols-outlined absolute left-3.5 text-slate-400 text-[20px] pointer-events-none">
                        lock
                      </span>
                      <input
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        type={showPassword ? 'text' : 'password'}
                        placeholder="••••••••••••"
                        className="w-full pl-11 pr-11 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/60 text-slate-900 dark:text-white font-medium text-sm focus:outline-none focus:border-[#064e3b] focus:ring-2 focus:ring-[#064e3b]/20 transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[20px]">
                          {showPassword ? 'visibility_off' : 'visibility'}
                        </span>
                      </button>
                    </div>
                  </div>

                  {/* Remember Me & Forgot Password Row */}
                  <div className="flex items-center justify-between pt-1">
                    <label className="flex items-center gap-2 cursor-pointer select-none text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-300">
                      <input
                        type="checkbox"
                        checked={rememberMe}
                        onChange={(e) => setRememberMe(e.target.checked)}
                        className="w-4 h-4 rounded text-[#064e3b] focus:ring-[#064e3b] accent-[#064e3b] cursor-pointer"
                      />
                      <span>Remember me</span>
                    </label>

                    <button
                      type="button"
                      onClick={() => navigate('/forgot-password')}
                      className="text-xs sm:text-sm font-extrabold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                    >
                      Forgot Password?
                    </button>
                  </div>

                  {/* Primary CTA Button */}
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3.5 rounded-2xl bg-[#064e3b] hover:bg-[#043b2c] active:scale-[0.99] text-white font-black text-sm sm:text-base shadow-md shadow-emerald-950/20 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-60"
                  >
                    <span>{loading ? 'Signing In...' : 'Sign In'}</span>
                    {!loading && <span className="material-symbols-outlined text-[20px]">arrow_forward</span>}
                  </button>
                </form>

                {/* Bottom Switch Link */}
                <div className="text-center pt-2">
                  <p className="text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400">
                    Don't have an account?{' '}
                    <button
                      type="button"
                      onClick={() => navigate('/signup')}
                      className="font-extrabold text-[#064e3b] dark:text-emerald-400 hover:underline cursor-pointer ml-1"
                    >
                      Create Account
                    </button>
                  </p>
                </div>
              </div>

              {/* AI INSIGHT Box below card */}
              <div className="bg-[#FAF5FF] dark:bg-purple-950/40 border border-purple-200/60 dark:border-purple-800/50 rounded-2xl p-4 flex items-start gap-3 shadow-2xs">
                <div className="w-8 h-8 rounded-xl bg-purple-100 dark:bg-purple-900/50 text-[#7C3AED] dark:text-purple-300 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-[18px]">auto_awesome</span>
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-[#7C3AED] dark:text-purple-400 block mb-0.5">
                    AI INSIGHT
                  </span>
                  <p className="text-xs font-semibold text-purple-950 dark:text-purple-200 leading-snug">
                    Personalized learning paths reduce study time by 40% while increasing retention of complex concepts.
                  </p>
                </div>
              </div>

            </div>

          </div>
        </div>
      </main>
    </div>
  );
};

export default Login;