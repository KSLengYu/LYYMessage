import { parse } from 'url';
import { promises as fs } from 'fs';
import path from 'path';

// 动态 import handler
async function loadHandler(name) {
  try {
    const modulePath = path.join(process.cwd(), 'api', 'handlers', name + '.js');
    await fs.access(modulePath); // 检查文件是否存在
    const handler = await import(`./handlers/${name}.js`);
    return handler.default;
  } catch (e) {
    return null;
  }
}

// 映射 URL 到 handler 文件名
const routeMap = {
  'admin/users': 'admin-users',  // 保留原来的二级路径
};

export default async function(req, res) {
  const { pathname } = parse(req.url, true);
  let apiPath = pathname.replace(/^\/api\/?/, '').replace(/\/$/, ''); // 去掉 /api/ 和尾部 /
  if (!apiPath) return res.status(404).json({ error:'missing endpoint' });

  // 映射特殊路径
  apiPath = routeMap[apiPath] || apiPath;

  const handler = await loadHandler(apiPath);
  if (!handler) return res.status(404).json({ error:'endpoint not found' });

  return handler(req, res);
}
