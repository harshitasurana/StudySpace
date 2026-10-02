import useAuth from './useAuth';
import { useStudentModeContext } from '../context/StudentModeContext';

// Whether the current user is a Student/School Student in "self" learning
// mode — used to gate features that only make sense for self-directed
// students (sample papers). Split out from the old Help Center access
// hook, which this same check was borrowed from before Help Center was
// removed.
const useSelfStudentMode = () => {
  const { user } = useAuth();
  const { mode, isLoading: modeLoading } = useStudentModeContext();

  const role = typeof user?.role === 'string' ? user.role.trim().toLowerCase() : user?.role;
  const isSelfStudent = (role === 'student' || role === 'school student') && mode === 'self';

  return { isSelfStudent, modeLoading };
};

export default useSelfStudentMode;
