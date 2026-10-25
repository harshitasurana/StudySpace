import React, { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import CategoryList from "../../components/categories/category-list/CategoryList.jsx";
import CategoryType from "../../components/categories/category-type/CategoryType.jsx";
import "../../components/categories/categories.css";

const TABS = [
  { key: "list", label: "Category List", icon: "bi bi-list-ul" },
  { key: "type", label: "Category Type", icon: "bi bi-tags" },
];

const resolveDefaultTab = (pathname) => {
  if (pathname.endsWith("/categories-type") || pathname.includes("/categories-type") || pathname.endsWith("/category-type") || pathname.includes("/category-type")) return "type";
  return "list";
};

/**
 * Parent page for the Categories module.
 * Owns only the page shell and tab navigation — no CRUD logic lives here.
 */
const CategoriesPage = () => {
  const location = useLocation();
  const [activeTab, setActiveTab] = useState(resolveDefaultTab(location.pathname));

  useEffect(() => {
    setActiveTab(resolveDefaultTab(location.pathname));
  }, [location.pathname]);

  return (
    <div className="cat-page">
      <div className="cat-header">
        <div>
          <h1 className="cat-header-title">Categories</h1>
          <p className="cat-header-subtitle">
            Manage application categories and category types
          </p>
        </div>
      </div>
      {activeTab === "list" && <CategoryList />}
      {activeTab === "type" && <CategoryType />}
    </div>
  );
};

export default CategoriesPage;