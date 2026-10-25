import { useStudentModeContext } from '../context/StudentModeContext';

const useStudentMode = () => {
  return useStudentModeContext();
};

export default useStudentMode;