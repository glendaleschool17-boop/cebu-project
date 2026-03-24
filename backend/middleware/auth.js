const { auth, db } = require('../config/firebase');

const verifyToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized: No token provided' });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await auth.verifyIdToken(token);
    req.user = decodedToken;
    next();
  } catch (error) {
    console.error('Token verification error:', error);
    res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }
};

const verifyAdmin = async (req, res, next) => {
  try {
    await verifyToken(req, res, async () => {
      // Fast path: custom claim set
      if (req.user.admin === true) {
        // Attach adminCity from claim (null = superAdmin sees all)
        req.adminCity = req.user.adminCity || null;
        req.isSuperAdmin = !req.user.adminCity;
        return next();
      }
      // Fallback: check Firestore role field
      const userDoc = await db.collection('users').doc(req.user.uid).get();
      if (userDoc.exists && userDoc.data().role === 'admin') {
        const data = userDoc.data();
        req.adminCity = data.adminCity || null;
        req.isSuperAdmin = !data.adminCity;
        // Backfill custom claims
        auth.setCustomUserClaims(req.user.uid, {
          admin: true,
          adminCity: data.adminCity || null,
        }).catch(() => {});
        return next();
      }
      return res.status(403).json({ error: 'Forbidden: Admin access required' });
    });
  } catch (error) {
    res.status(403).json({ error: 'Forbidden' });
  }
};

/**
 * Set (or revoke) the admin custom claim on a Firebase Auth user.
 * adminCity: null = superAdmin (sees all), string = regional admin (e.g. 'CEB')
 */
const setAdminClaim = async (uid, isAdmin, adminCity = null) => {
  if (isAdmin) {
    await auth.setCustomUserClaims(uid, { admin: true, adminCity: adminCity || null });
  } else {
    await auth.setCustomUserClaims(uid, { admin: false, adminCity: null });
  }
};

/**
 * Helper: filter bookings array by adminCity.
 * SuperAdmin (adminCity=null) sees all.
 * Regional admin only sees bookings where their city is the origin OR destination.
 */
const filterBookingsByCity = (bookings, adminCity, flightMap) => {
  if (!adminCity) return bookings; // superAdmin
  return bookings.filter(b => {
    const flight = flightMap[b.flightId];
    const returnFlight = flightMap[b.returnFlightId];
    if (flight && (flight.origin === adminCity || flight.destination === adminCity)) return true;
    if (returnFlight && (returnFlight.origin === adminCity || returnFlight.destination === adminCity)) return true;
    return false;
  });
};

const verifyGateAgent = async (req, res, next) => {
  try {
    await verifyToken(req, res, async () => {
      // Allow admins and gate_agents
      if (req.user.admin === true) return next();
      const userDoc = await db.collection('users').doc(req.user.uid).get();
      if (userDoc.exists) {
        const data = userDoc.data();
        if (data.role === 'admin' || data.role === 'gate_agent') return next();
      }
      return res.status(403).json({ error: 'Forbidden: Gate Agent or Admin access required' });
    });
  } catch (error) {
    res.status(403).json({ error: 'Forbidden' });
  }
};

module.exports = { verifyToken, verifyAdmin, verifyGateAgent, setAdminClaim, filterBookingsByCity };
