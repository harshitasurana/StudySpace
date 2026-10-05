import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AuthService from '../../../services/AuthService';
import AuthHeader from '../components/AuthHeader';
import AuthHeroPanel from '../components/AuthHeroPanel';

const ForgotPassword = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleForgot = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await AuthService.forgotPassword(email);
      setMessage(data.message || 'If that email exists, a password reset link has been sent to your inbox.');
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong. Please check your email and try again.');
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
            
            {/* Left Hero Panel */}
            <AuthHeroPanel
              titlePrefix="Recover Your"
              titleHighlight="Account."
              subtitle="Enter your registered email address below. We'll send you an encrypted password reset link immediately."
            />

            {/* Right Card Panel */}
            <div className="w-full lg:w-1/2 flex flex-col justify-center space-y-4">
              <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 shadow-xl border border-slate-200/80 dark:border-slate-800 space-y-6">
                
                <div>
                  <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                    Forgot Password
                  </h2>
                  <p className="text-slate-500 dark:text-slate-400 font-medium text-xs sm:text-sm mt-1">
                    Enter your email to receive a password reset link.
                  </p>
                </div>

                {error && (
                  <div className="p-3.5 bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 font-bold rounded-2xl text-xs sm:text-sm border border-rose-200 dark:border-rose-900/60 text-center">
                    {error}
                  </div>
                )}

                {message && (
                  <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 font-bold rounded-2xl text-xs sm:text-sm border border-emerald-200 dark:border-emerald-800/60 text-center">
                    {message}
                  </div>
                )}

                <form className="space-y-5" onSubmit={handleForgot}>
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

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3.5 rounded-2xl bg-[#064e3b] hover:bg-[#043b2c] active:scale-[0.99] text-white font-black text-sm sm:text-base shadow-md shadow-emerald-950/20 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-60"
                  >
                    <span>{loading ? 'Sending Request...' : 'Send Reset Link'}</span>
                    {!loading && <span className="material-symbols-outlined text-[20px]">send</span>}
                  </button>
                </form>

                <div className="text-center pt-2 border-t border-slate-200 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => navigate('/login')}
                    className="font-extrabold text-xs sm:text-sm text-[#064e3b] dark:text-emerald-400 hover:underline cursor-pointer inline-flex items-center gap-1"
                  >
                    <span className="material-symbols-outlined text-[16px]">arrow_back</span>
                    <span>Back to Login</span>
                  </button>
                </div>
              </div>
            </div>

          </div>
        </div>
      </main>
    </div>
  );
};

export default ForgotPassword;