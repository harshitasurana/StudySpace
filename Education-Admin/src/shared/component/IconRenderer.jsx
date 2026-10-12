import React, { useState, useEffect } from 'react';

const ICON_LIBRARIES = {
  fa:  () => import('react-icons/fa'),
  fa6: () => import('react-icons/fa6'),
  si:  () => import('react-icons/si'),
  fi:  () => import('react-icons/fi'),
  md:  () => import('react-icons/md'),
  ai:  () => import('react-icons/ai'),
  hi:  () => import('react-icons/hi'),
  hi2: () => import('react-icons/hi2'),
  io:  () => import('react-icons/io'),
  io5: () => import('react-icons/io5'),
  gi:  () => import('react-icons/gi'),
  cg:  () => import('react-icons/cg'),
  wi:  () => import('react-icons/wi'),
  ti:  () => import('react-icons/ti'),
  ri:  () => import('react-icons/ri'),
  tb:  () => import('react-icons/tb'),
  rx:  () => import('react-icons/rx'),
  gr:  () => import('react-icons/gr'),
  im:  () => import('react-icons/im'),
  fc:  () => import('react-icons/fc'),
  go:  () => import('react-icons/go'),
  lu:  () => import('react-icons/lu'),
  vsc: () => import('react-icons/vsc'),
  pi:  () => import('react-icons/pi'),
  bs:  () => import('react-icons/bs'),
  bi:  () => import('react-icons/bi'),
};

const cache = {};

const DynamicIcon = ({ pkg, name, ...props }) => {
  const key = `${pkg}:${name}`;
  const [Component, setComponent] = useState(() => cache[key] || null);

  useEffect(() => {
    if (cache[key]) return;

    const loader = ICON_LIBRARIES[pkg];
    if (!loader) return;

    loader().then((mod) => {
      const keys = Object.keys(mod);
      const C = mod[name] || (mod.default && mod.default[name]);
      if (!C) {
        console.error(`Icon "${name}" not found (${keys.length} exports)`, {
          isInKeys: name === 'AiFillProduct' ? keys.indexOf(name) : undefined,
          product: typeof mod.AiFillProduct,
          account: typeof mod.AiFillAccountBook,
          zhihu: typeof mod.AiFillZhihuSquare,
          first5: keys.slice(0, 5),
          last5: keys.slice(-5),
        });
        return;
      }
      cache[key] = C;
      setComponent(() => C);
    });
  }, [key, pkg, name]);

  if (!Component) return <i className="bi bi-circle" />;
  return <Component {...props} />;
};

const IconRenderer = ({ icon, className, style, ...props }) => {
  if (!icon) return <i className="bi bi-circle" />;

  if (icon.includes('/')) {
    const [pkg, name] = icon.split('/');
    return <DynamicIcon pkg={pkg} name={name} className={className} style={style} {...props} />;
  }

  const spaceIndex = icon.indexOf(' ');
  if (spaceIndex > 0) {
    const second = icon.slice(spaceIndex + 1).trim();
    if (second && /^[A-Z]/.test(second)) {
      const pkg = icon.slice(0, spaceIndex).trim();
      return <DynamicIcon pkg={pkg} name={second} className={className} style={style} {...props} />;
    }
  }

  return <i className={icon} style={style} {...props} />;
};

export default IconRenderer;
