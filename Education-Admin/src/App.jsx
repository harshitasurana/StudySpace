import "./App.css";
import { RouterProvider, createBrowserRouter, Outlet } from "react-router-dom";
import Login from "./pages/AdminLoginPage.jsx";
import ForgetPassword from "./pages/ForgetPassword.jsx";
import ResetPassword from "./pages/ResetPassword.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import AdminHomePage from "./pages/AdminHomePage.jsx";
import StandaloneModules from "./pages/StandaloneModules.jsx";

const RootLayout = () => <Outlet />;

function App() {
  const route = createBrowserRouter([
    {
      path: "/",
      element: <RootLayout />,
      children: [
        {
          path: "/",
          element: <Login />,
        },
        {
          path: "/login",
          element: <Login />,
        },
        {
          path: "/forgot-password",
          element: <ForgetPassword />,
        },
        {
          path: "/reset-password",
          element: <ResetPassword />,
        },
        {
          path: "/dashboard",
          element: <Dashboard />,
        },
        {
          path: "/home",
          element: <AdminHomePage />,
        },
        {
          path: "/admin/roles",
          element: <StandaloneModules />,
        },
        {
          path: "/dashboard/doctors",
          element: <Dashboard />,
        },
        {
          path: "/dashboard/appointments",
          element: <Dashboard />,
        },
        {
          path: "/admin/users",
          element: <Dashboard />,
        },
        {
          path: "/admin/features",
          element: <StandaloneModules />,
        },
        {
          path: "/admin/features/add",
          element: <StandaloneModules />,
        },
        {
          path: "/admin/feature-permissions",
          element: <StandaloneModules />,
        },
        {
          path: "/admin/feature-availability-types",
          element: <StandaloneModules />,
        },
        {
          path: "/admin/feature-availability-map",
          element: <StandaloneModules />,
        },
        {
          path: "/admin/menu-ordering",
          element: <StandaloneModules />,
        },
        {
          path: "/admin/category-list",
          element: <StandaloneModules />,
        },
        {
          path: "/admin/categories-list",
          element: <StandaloneModules />,
        },
        {
          path: "/admin/category-type",
          element: <StandaloneModules />,
        },
        {
          path: "/admin/categories-type",
          element: <StandaloneModules />,
        },
        {
          path: "/admin/curriculum",
          element: <StandaloneModules />,
        },
        {
          path: "/admin/sample-papers",
          element: <StandaloneModules />,
        },
        {
          path: "/admin/user-activity",
          element: <StandaloneModules />,
        },
        {
          path: "/admin/ai-provider-keys",
          element: <StandaloneModules />,
        },
      ],
    },
  ]);

  return (
    <div className="App">
      <RouterProvider router={route}></RouterProvider>
    </div>
  );
}

export default App;
