// Jerarquía: admin > teacher > parent
const ROLE_LEVELS = { admin: 3, teacher: 2, parent: 1 };

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'No autenticado' });
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'No tienes permiso para esta acción' });
    }
    next();
  };
}

function requireMinRole(minRole) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'No autenticado' });
    if ((ROLE_LEVELS[req.user.role] || 0) < (ROLE_LEVELS[minRole] || 0)) {
      return res.status(403).json({ error: 'Permisos insuficientes' });
    }
    next();
  };
}

module.exports = { requireRole, requireMinRole };
