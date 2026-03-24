import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../utils/api';
import { toast } from 'react-toastify';

const FlightSearch = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [tripType, setTripType] = useState(searchParams.get('tripType') || 'oneway');
  const [search, setSearch] = useState({
    origin: searchParams.get('origin') || '',
    destination: searchParams.get('destination') || '',
    date: searchParams.get('date') || '',
    returnDate: searchParams.get('returnDate') || '',
  });
  const [sameRouteError, setSameRouteError] = useState(false);
  const [passengerCount, setPassengerCount] = useState(1);

  const [outboundFlights, setOutboundFlights] = useState([]);
  const [returnFlights, setReturnFlights] = useState([]);
  const [outboundCursor, setOutboundCursor] = useState(null);
  const [returnCursor, setReturnCursor] = useState(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loading, setLoading] = useState(true); // start loading immediately
  const [searched, setSearched] = useState(true); // auto-show results
  const [hasFilters, setHasFilters] = useState(false); // track if user applied filters
  const [sortBy, setSortBy] = useState(''); // '' | 'price_asc' | 'price_desc' | 'dep_asc' | 'dep_desc' | 'dur_asc' | 'dur_desc'

  // Round trip selection state
  const [selectedOutbound, setSelectedOutbound] = useState(null);
  const [selectedReturn, setSelectedReturn] = useState(null);
  const [step, setStep] = useState('outbound'); // 'outbound' | 'return' | 'confirm'

  const cities = [
    { code: 'MNL', name: 'Manila (NAIA)' }, { code: 'CEB', name: 'Cebu (Mactan)' },
    { code: 'DVO', name: 'Davao (Francisco Bangoy)' }, { code: 'ILO', name: 'Iloilo' },
    { code: 'BCD', name: 'Bacolod' }, { code: 'ZAM', name: 'Zamboanga' },
    { code: 'GEN', name: 'General Santos' }, { code: 'LGP', name: 'Legazpi' },
    { code: 'KLO', name: 'Kalibo' }, { code: 'PPS', name: 'Puerto Princesa' },
  ];

  useEffect(() => {
    document.title = 'Search Flights – Cebu Airline';
    // Always auto-load on mount — no filters = show all upcoming flights
    doSearch(search);
  }, []);

  const handleSwap = () => {
    setSearch(s => ({ ...s, origin: s.destination, destination: s.origin }));
    setSameRouteError(false);
  };

  const doSearch = async (s) => {
    const currentSearch = s || search;
    const isFiltered = !!(currentSearch.origin || currentSearch.destination || currentSearch.date);
    setHasFilters(isFiltered);
    setLoading(true);
    setSearched(true);
    setSelectedOutbound(null);
    setSelectedReturn(null);
    setStep('outbound');
    setOutboundCursor(null);
    setReturnCursor(null);
    try {
      const params = new URLSearchParams();
      if (currentSearch.origin) params.append('origin', currentSearch.origin);
      if (currentSearch.destination) params.append('destination', currentSearch.destination);
      if (currentSearch.date) params.append('date', currentSearch.date);
      const outData = await api.get(`/flights?${params.toString()}`);
      setOutboundFlights(outData.flights || []);
      setOutboundCursor(outData.nextCursor || null);

      if (tripType === 'roundtrip' && currentSearch.returnDate) {
        const rParams = new URLSearchParams();
        rParams.append('origin', currentSearch.destination);
        rParams.append('destination', currentSearch.origin);
        rParams.append('date', currentSearch.returnDate);
        const retData = await api.get(`/flights?${rParams.toString()}`);
        setReturnFlights(retData.flights || []);
        setReturnCursor(retData.nextCursor || null);
      }
    } catch (err) {
      toast.error('Failed to search flights');
    } finally {
      setLoading(false);
    }
  };

  const handleLoadMoreOutbound = async () => {
    if (!outboundCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const params = new URLSearchParams();
      if (search.origin) params.append('origin', search.origin);
      if (search.destination) params.append('destination', search.destination);
      if (search.date) params.append('date', search.date);
      params.append('startAfter', outboundCursor);
      const data = await api.get(`/flights?${params.toString()}`);
      setOutboundFlights(prev => [...prev, ...(data.flights || [])]);
      setOutboundCursor(data.nextCursor || null);
    } catch (err) {
      toast.error('Failed to load more flights');
    } finally {
      setLoadingMore(false);
    }
  };

  const handleLoadMoreReturn = async () => {
    if (!returnCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const rParams = new URLSearchParams();
      rParams.append('origin', search.destination);
      rParams.append('destination', search.origin);
      if (search.returnDate) rParams.append('date', search.returnDate);
      rParams.append('startAfter', returnCursor);
      const data = await api.get(`/flights?${rParams.toString()}`);
      setReturnFlights(prev => [...prev, ...(data.flights || [])]);
      setReturnCursor(data.nextCursor || null);
    } catch (err) {
      toast.error('Failed to load more return flights');
    } finally {
      setLoadingMore(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    if (search.origin && search.destination && search.origin === search.destination) {
      return toast.error('Origin and destination cannot be the same. Please select different cities.');
    }
    if (tripType === 'roundtrip' && !search.returnDate) {
      return toast.error('Please select a return date');
    }
    if (search.returnDate && search.returnDate <= search.date) {
      return toast.error('Return date must be after departure date');
    }
    doSearch(search);
  };

  const handleSelectOutbound = (flight) => {
    if (!user) { toast.info('Please login to book'); navigate('/login'); return; }
    if (flight.availableSeats === 0) { toast.error('This flight is full.'); return; }
    if (tripType === 'oneway') {
      navigate(`/book/${flight.id}?passengers=${passengerCount}`);
    } else {
      setSelectedOutbound(flight);
      setStep('return');
    }
  };

  const handleSelectReturn = (flight) => {
    if (flight.availableSeats === 0) { toast.error('This flight is full.'); return; }
    setSelectedReturn(flight);
    setStep('confirm');
  };

  const handleConfirmRoundTrip = () => {
    navigate(`/book/${selectedOutbound.id}?returnFlightId=${selectedReturn.id}&tripType=roundtrip&passengers=${passengerCount}`);
  };

  const formatTime = (dt) => new Date(dt).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' });
  const formatDate = (dt) => new Date(dt).toLocaleDateString('en-PH', { weekday: 'short', month: 'short', day: 'numeric' });
  const getDuration = (dep, arr) => {
    const diff = (new Date(arr) - new Date(dep)) / 60000;
    return `${Math.floor(diff / 60)}h ${diff % 60}m`;
  };

  const sortFlights = (flights) => {
    if (!sortBy) return flights;
    return [...flights].sort((a, b) => {
      if (sortBy === 'price_asc') return (a.price || 0) - (b.price || 0);
      if (sortBy === 'price_desc') return (b.price || 0) - (a.price || 0);
      if (sortBy === 'dep_asc') return new Date(a.departureTime) - new Date(b.departureTime);
      if (sortBy === 'dep_desc') return new Date(b.departureTime) - new Date(a.departureTime);
      if (sortBy === 'dur_asc') return ((new Date(a.arrivalTime) - new Date(a.departureTime)) - (new Date(b.arrivalTime) - new Date(b.departureTime)));
      if (sortBy === 'dur_desc') return ((new Date(b.arrivalTime) - new Date(b.departureTime)) - (new Date(a.arrivalTime) - new Date(a.departureTime)));
      return 0;
    });
  };

  const SkeletonCard = () => (
    <div style={{ background: 'white', borderRadius: 16, padding: '24px 28px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 4px 20px rgba(0,51,153,0.06)', gap: 24, border: '1px solid #eef0ff' }}>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 32 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0 }}>
          <div style={skeletonStyle(32, 80)} />
          <div style={skeletonStyle(14, 60)} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          <div style={{ textAlign: 'center' }}>
            <div style={skeletonStyle(28, 60)} />
            <div style={{ ...skeletonStyle(12, 40), marginTop: 6 }} />
          </div>
          <div style={{ textAlign: 'center', minWidth: 100 }}>
            <div style={{ ...skeletonStyle(12, 70), margin: '0 auto 8px' }} />
            <div style={{ height: 2, background: '#e8ecf8', borderRadius: 2, margin: '4px 0' }} />
            <div style={{ ...skeletonStyle(12, 50), margin: '4px auto 0' }} />
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={skeletonStyle(28, 60)} />
            <div style={{ ...skeletonStyle(12, 40), marginTop: 6 }} />
          </div>
        </div>
        <div style={skeletonStyle(13, 100)} />
      </div>
      <div style={{ textAlign: 'center', flexShrink: 0, minWidth: 140, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
        <div style={skeletonStyle(28, 90)} />
        <div style={skeletonStyle(12, 60)} />
        <div style={skeletonStyle(40, 120, 8)} />
      </div>
    </div>
  );

  const skeletonStyle = (h, w, radius = 6) => ({
    height: h, width: w, borderRadius: radius,
    background: 'linear-gradient(90deg, #eef0ff 25%, #dde4ff 50%, #eef0ff 75%)',
    backgroundSize: '200% 100%',
    animation: 'shimmer 1.4s infinite',
  });

  const FlightCard = ({ flight, onSelect, isSelected, selectLabel = 'Book Now' }) => {
    const isSoldOut = flight.availableSeats === 0;
    return (
    <div style={{
      ...styles.flightCard,
      border: isSoldOut ? '1.5px solid #ffcccc' : isSelected ? '2px solid #003399' : '1px solid #dde4ff',
      background: isSoldOut ? '#fff8f8' : isSelected ? '#f0f4ff' : 'white',
      opacity: isSoldOut ? 0.85 : 1,
    }}>
      <div style={styles.flightLeft}>
        <div style={styles.airline}>
          <span style={styles.airlineIcon}>✈️</span>
          <div>
            <div style={styles.flightNum}>{flight.flightNumber}</div>
            <div style={styles.aircraft}>{flight.aircraft}</div>
          </div>
        </div>
        <div style={styles.route}>
          <div style={styles.routePoint}>
            <div style={styles.time}>{formatTime(flight.departureTime)}</div>
            <div style={styles.code}>{flight.origin}</div>
            <div style={styles.city}>{flight.originCity}</div>
          </div>
          <div style={styles.routeMiddle}>
            <div style={styles.duration}>{getDuration(flight.departureTime, flight.arrivalTime)}</div>
            <div style={styles.routeLine}><span style={styles.planeDot}>✈</span></div>
            <div style={styles.direct}>Direct</div>
          </div>
          <div style={styles.routePoint}>
            <div style={styles.time}>{formatTime(flight.arrivalTime)}</div>
            <div style={styles.code}>{flight.destination}</div>
            <div style={styles.city}>{flight.destinationCity}</div>
          </div>
        </div>
        <div style={styles.date}>{formatDate(flight.departureTime)}</div>
      </div>
      <div style={styles.flightRight}>
        {isSoldOut ? (
          <>
            <div style={styles.soldOutBadge}>🚫 SOLD OUT</div>
            <div style={styles.soldOutSub}>No seats available</div>
            <div style={styles.price}>₱{flight.price?.toLocaleString()}</div>
            <div style={styles.perPerson}>per person</div>
            <button
              className="btn-primary"
              disabled
              style={{ padding: '12px 24px', fontSize: 15, width: '100%', opacity: 0.4, cursor: 'not-allowed', background: '#999' }}
            >
              Sold Out
            </button>
          </>
        ) : (
          <>
            <div style={styles.seatsInfo}>
              <span style={{ color: flight.availableSeats < 10 ? '#cc2222' : '#007744', fontWeight: 700, fontSize: 14 }}>
                {flight.availableSeats} seat{flight.availableSeats !== 1 ? 's' : ''} left
              </span>
            </div>
            <div style={styles.price}>₱{flight.price?.toLocaleString()}</div>
            <div style={styles.perPerson}>per person{passengerCount > 1 ? ` × ${passengerCount}` : ''}</div>
            {passengerCount > 1 && (
              <div style={{ fontSize: 13, fontWeight: 700, color: '#ff6600', marginBottom: 12 }}>
                Total: ₱{(flight.price * passengerCount).toLocaleString()}
              </div>
            )}
            <button
              className="btn-primary"
              onClick={() => onSelect(flight)}
              style={{ padding: '12px 24px', fontSize: 15, width: '100%' }}
            >
              {isSelected ? '✓ Selected' : selectLabel}
            </button>
          </>
        )}
      </div>
    </div>
    );
  };

  return (
    <div style={styles.page}>
      <div className="container">

        {/* Search Form */}
        <div style={styles.searchSection}>
          <div style={styles.searchHeader}>
            <h1 style={styles.title}>Find Your Flight</h1>
            {/* Trip type toggle */}
            <div style={styles.tripToggle}>
              <button
                type="button"
                style={{ ...styles.tripBtn, ...(tripType === 'oneway' ? styles.tripBtnActive : {}) }}
                onClick={() => { setTripType('oneway'); }}
              >
                ➡️ One Way
              </button>
              <button
                type="button"
                style={{ ...styles.tripBtn, ...(tripType === 'roundtrip' ? styles.tripBtnActive : {}) }}
                onClick={() => { setTripType('roundtrip'); }}
              >
                🔄 Round Trip
              </button>
            </div>
          </div>

          <form onSubmit={handleSearch} style={styles.searchForm}>
            <div style={styles.searchRow}>
              <div className="form-group" style={{ flex: 1, margin: 0 }}>
                <label>From</label>
                <select className="input-field" value={search.origin} onChange={e => {
                  const val = e.target.value;
                  setSearch({ ...search, origin: val });
                  setSameRouteError(val && search.destination && val === search.destination);
                }} required>
                  <option value="">Select Origin</option>
                  {cities.map(c => <option key={c.code} value={c.code}>{c.code} – {c.name}</option>)}
                </select>
              </div>

              <div style={{ alignSelf: 'flex-end', paddingBottom: 8, flexShrink: 0 }}>
                <button
                  type="button"
                  onClick={handleSwap}
                  title="Swap origin and destination"
                  style={{
                    background: search.origin || search.destination ? 'white' : 'rgba(255,255,255,0.15)',
                    color: search.origin || search.destination ? '#003399' : 'rgba(255,255,255,0.5)',
                    border: '2px solid rgba(255,255,255,0.3)',
                    borderRadius: '50%',
                    width: 34, height: 34,
                    fontSize: 15, fontWeight: 800,
                    cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'background 0.2s, transform 0.18s',
                    padding: 0,
                    lineHeight: 1,
                  }}
                  onMouseEnter={e => e.currentTarget.style.transform = 'rotate(180deg)'}
                  onMouseLeave={e => e.currentTarget.style.transform = 'rotate(0deg)'}
                >
                  ⇄
                </button>
              </div>

              <div className="form-group" style={{ flex: 1, margin: 0 }}>
                <label>To</label>
                <select
                  className="input-field"
                  value={search.destination}
                  onChange={e => {
                    const val = e.target.value;
                    setSearch({ ...search, destination: val });
                    setSameRouteError(val && search.origin && val === search.origin);
                  }}
                  style={sameRouteError ? { borderColor: '#cc2222', background: '#fff5f5' } : {}}
                  required
                >
                  <option value="">Select Destination</option>
                  {cities.map(c => <option key={c.code} value={c.code}>{c.code} – {c.name}</option>)}
                </select>
                {sameRouteError && (
                  <div style={{ color: '#ff4444', fontSize: 12, fontWeight: 700, marginTop: 6, background: 'rgba(255,255,255,0.9)', borderRadius: 6, padding: '4px 10px', display: 'inline-block' }}>
                    ⚠ Origin and destination cannot be the same
                  </div>
                )}
              </div>

              <div className="form-group" style={{ minWidth: 160, margin: 0 }}>
                <label>Departure Date</label>
                <input type="date" className="input-field" value={search.date}
                  min={new Date().toISOString().split('T')[0]}
                  onChange={e => setSearch({ ...search, date: e.target.value })} required />
              </div>

              {tripType === 'roundtrip' && (
                <div className="form-group" style={{ minWidth: 160, margin: 0 }}>
                  <label>Return Date</label>
                  <input type="date" className="input-field" value={search.returnDate}
                    min={search.date || new Date().toISOString().split('T')[0]}
                    onChange={e => setSearch({ ...search, returnDate: e.target.value })} required />
                </div>
              )}

              <div className="form-group" style={{ minWidth: 130, margin: 0 }}>
                <label>Passengers</label>
                <div style={styles.passengerPicker}>
                  <button type="button" style={styles.pickerBtn} onClick={() => setPassengerCount(c => Math.max(1, c - 1))}>−</button>
                  <span style={styles.pickerVal}>{passengerCount}</span>
                  <button type="button" style={styles.pickerBtn} onClick={() => setPassengerCount(c => Math.min(9, c + 1))}>+</button>
                </div>
              </div>

              <button type="submit" className="btn-primary" disabled={sameRouteError} style={{ alignSelf: 'flex-end', padding: '12px 28px', marginTop: 20, background: sameRouteError ? '#aaa' : 'white', color: '#003399', cursor: sameRouteError ? 'not-allowed' : 'pointer' }}>
                Search ✈️
              </button>
            </div>
          </form>
        </div>

        {/* Round Trip Summary Banner */}
        {tripType === 'roundtrip' && searched && !loading && (
          <div style={styles.rtBanner}>
            <div style={styles.rtStep(step === 'outbound')}>
              <div style={styles.rtStepNum}>1</div>
              <div>
                <div style={styles.rtStepLabel}>Outbound Flight</div>
                <div style={styles.rtStepSub}>{search.origin} → {search.destination}</div>
              </div>
              {selectedOutbound && <div style={styles.rtCheck}>✓</div>}
            </div>
            <div style={styles.rtArrow}>→</div>
            <div style={styles.rtStep(step === 'return')}>
              <div style={styles.rtStepNum}>2</div>
              <div>
                <div style={styles.rtStepLabel}>Return Flight</div>
                <div style={styles.rtStepSub}>{search.destination} → {search.origin}</div>
              </div>
              {selectedReturn && <div style={styles.rtCheck}>✓</div>}
            </div>
            <div style={styles.rtArrow}>→</div>
            <div style={styles.rtStep(step === 'confirm')}>
              <div style={styles.rtStepNum}>3</div>
              <div>
                <div style={styles.rtStepLabel}>Confirm & Book</div>
                {selectedOutbound && selectedReturn && (
                  <div style={styles.rtStepSub}>
                    Total: ₱{((selectedOutbound.price || 0) + (selectedReturn.price || 0)).toLocaleString()}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {loading && (
          <div>
            <div style={styles.sortBar}>
              <div style={{ height: 14, width: 80, background: '#eef0ff', borderRadius: 6 }} />
              {[1,2,3].map(i => <div key={i} style={{ height: 34, width: 120, background: '#eef0ff', borderRadius: 8 }} />)}
            </div>
            <div style={styles.flightsList}>
              {[1,2,3].map(i => <SkeletonCard key={i} />)}
            </div>
          </div>
        )}

        {!loading && searched && (
          <>
            {/* Sort Bar */}
            {(step === 'outbound' || step === 'return' || tripType === 'oneway') && (
              <div style={styles.sortBar}>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#555', flexShrink: 0 }}>Sort by:</span>
                {[
                  { value: 'price_asc', label: '💰 Price ↑' },
                  { value: 'price_desc', label: '💰 Price ↓' },
                  { value: 'dep_asc', label: '🕐 Earliest' },
                  { value: 'dep_desc', label: '🕐 Latest' },
                  { value: 'dur_asc', label: '⏱ Shortest' },
                  { value: 'dur_desc', label: '⏱ Longest' },
                ].map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setSortBy(v => v === opt.value ? '' : opt.value)}
                    style={{ ...styles.sortBtn, ...(sortBy === opt.value ? styles.sortBtnActive : {}) }}
                  >
                    {opt.label}
                  </button>
                ))}
                {sortBy && <button onClick={() => setSortBy('')} style={styles.sortClearBtn}>✕ Clear</button>}
              </div>
            )}
            {/* OUTBOUND flights */}
            {(step === 'outbound' || tripType === 'oneway') && (
              <>
                <div style={styles.resultsHeader}>
                  <h2 style={styles.resultsTitle}>
                    {tripType === 'roundtrip'
                      ? `✈️ Step 1: Select Outbound Flight`
                      : hasFilters
                        ? `${outboundFlights.length} flight(s) found`
                        : `All Upcoming Flights (${outboundFlights.length})`
                    }
                    {hasFilters && search.origin && search.destination && ` — ${search.origin} → ${search.destination}`}
                  </h2>
                  {hasFilters && (
                    <button
                      onClick={() => {
                        const cleared = { origin: '', destination: '', date: '', returnDate: '' };
                        setSearch(cleared);
                        doSearch(cleared);
                      }}
                      style={styles.backStepBtn}
                    >
                      ✕ Clear Filters
                    </button>
                  )}
                </div>
                {outboundFlights.length === 0 ? (
                  <div style={styles.emptyState}>
                    <div style={{ fontSize: 60, marginBottom: 16 }}>✈️</div>
                    <h3 style={{ color: '#003399' }}>{hasFilters ? 'No Flights Found' : 'No Upcoming Flights'}</h3>
                    <p style={{ color: '#888' }}>{hasFilters ? 'Try different dates or routes.' : 'Check back soon for new schedules.'}</p>
                  </div>
                ) : (
                  <div style={styles.flightsList}>
                    {sortFlights(outboundFlights).map(flight => (
                      <FlightCard
                        key={flight.id}
                        flight={flight}
                        onSelect={handleSelectOutbound}
                        isSelected={selectedOutbound?.id === flight.id}
                        selectLabel={tripType === 'roundtrip' ? 'Select →' : 'Book Now'}
                      />
                    ))}
                    {outboundCursor && (
                      <button
                        onClick={handleLoadMoreOutbound}
                        disabled={loadingMore}
                        style={styles.loadMoreBtn}
                      >
                        {loadingMore ? '⏳ Loading…' : '⬇️ Load More Flights'}
                      </button>
                    )}
                  </div>
                )}
              </>
            )}

            {/* RETURN flights */}
            {tripType === 'roundtrip' && step === 'return' && (
              <>
                <div style={styles.resultsHeader}>
                  <h2 style={styles.resultsTitle}>
                    🔄 Step 2: Select Return Flight — {search.destination} → {search.origin}
                  </h2>
                  <button onClick={() => { setStep('outbound'); setSelectedOutbound(null); }} style={styles.backStepBtn}>← Change Outbound</button>
                </div>
                {returnFlights.length === 0 ? (
                  <div style={styles.emptyState}>
                    <div style={{ fontSize: 60, marginBottom: 16 }}>🔄</div>
                    <h3 style={{ color: '#003399' }}>No Return Flights Available</h3>
                    <p style={{ color: '#888' }}>Try a different return date.</p>
                  </div>
                ) : (
                  <div style={styles.flightsList}>
                    {sortFlights(returnFlights).map(flight => (
                      <FlightCard
                        key={flight.id}
                        flight={flight}
                        onSelect={handleSelectReturn}
                        isSelected={selectedReturn?.id === flight.id}
                        selectLabel="Select →"
                      />
                    ))}
                    {returnCursor && (
                      <button
                        onClick={handleLoadMoreReturn}
                        disabled={loadingMore}
                        style={styles.loadMoreBtn}
                      >
                        {loadingMore ? '⏳ Loading…' : '⬇️ Load More Return Flights'}
                      </button>
                    )}
                  </div>
                )}
              </>
            )}

            {/* CONFIRM round trip */}
            {tripType === 'roundtrip' && step === 'confirm' && selectedOutbound && selectedReturn && (
              <div style={styles.confirmCard}>
                <h2 style={styles.confirmTitle}>✅ Confirm Round Trip</h2>

                <div style={styles.confirmLegs}>
                  <div style={styles.confirmLeg}>
                    <div style={styles.legHeader}>✈️ Outbound</div>
                    <div style={styles.legRoute}>{selectedOutbound.origin} → {selectedOutbound.destination}</div>
                    <div style={styles.legDetail}>{selectedOutbound.flightNumber} · {formatDate(selectedOutbound.departureTime)} · {formatTime(selectedOutbound.departureTime)}</div>
                    <div style={styles.legPrice}>₱{selectedOutbound.price?.toLocaleString()}</div>
                  </div>
                  <div style={styles.confirmLegDivider}>+</div>
                  <div style={styles.confirmLeg}>
                    <div style={styles.legHeader}>🔄 Return</div>
                    <div style={styles.legRoute}>{selectedReturn.origin} → {selectedReturn.destination}</div>
                    <div style={styles.legDetail}>{selectedReturn.flightNumber} · {formatDate(selectedReturn.departureTime)} · {formatTime(selectedReturn.departureTime)}</div>
                    <div style={styles.legPrice}>₱{selectedReturn.price?.toLocaleString()}</div>
                  </div>
                </div>

                <div style={styles.confirmTotal}>
                  <span>Total (both flights)</span>
                  <span style={{ color: '#ff6600', fontSize: 28, fontWeight: 900 }}>
                    ₱{((selectedOutbound.price || 0) + (selectedReturn.price || 0)).toLocaleString()}
                  </span>
                </div>

                <div style={styles.confirmActions}>
                  <button onClick={() => { setStep('return'); setSelectedReturn(null); }} style={styles.backStepBtn}>← Change Return</button>
                  <button className="btn-primary" onClick={handleConfirmRoundTrip} style={{ padding: '14px 40px', fontSize: 16 }}>
                    Book Round Trip →
                  </button>
                </div>
              </div>
            )}
          </>
        )}

      </div>
    </div>
  );
};

const styles = {
  page: { padding: '32px 0 60px', minHeight: '80vh' },
  searchSection: {
    background: 'linear-gradient(135deg, #001f66 0%, #003399 100%)',
    borderRadius: 20, padding: 36, marginBottom: 28, color: 'white',
  },
  searchHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 },
  title: { fontFamily: 'Montserrat, sans-serif', fontSize: 28, fontWeight: 800, color: 'white', margin: 0 },
  tripToggle: { display: 'flex', gap: 8, background: 'rgba(0,0,0,0.2)', borderRadius: 10, padding: 4 },
  tripBtn: {
    padding: '8px 20px', borderRadius: 8, border: 'none', cursor: 'pointer',
    fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.7)', background: 'none',
    transition: 'all 0.2s',
  },
  tripBtnActive: {
    background: 'white', color: '#003399', boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
  },
  searchForm: {},
  searchRow: { display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'flex-end' },

  // Round trip steps banner
  rtBanner: {
    display: 'flex', alignItems: 'center', gap: 12,
    background: 'white', borderRadius: 14, padding: '16px 24px',
    boxShadow: '0 4px 20px rgba(0,51,153,0.08)', border: '1px solid #dde4ff',
    marginBottom: 24, flexWrap: 'wrap',
  },
  rtStep: (active) => ({
    display: 'flex', alignItems: 'center', gap: 12, flex: 1,
    padding: '10px 16px', borderRadius: 10,
    background: active ? '#e8eeff' : '#f8faff',
    border: `2px solid ${active ? '#003399' : '#dde4ff'}`,
    position: 'relative',
  }),
  rtStepNum: {
    width: 28, height: 28, borderRadius: '50%',
    background: '#003399', color: 'white',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontWeight: 800, fontSize: 14, flexShrink: 0,
  },
  rtStepLabel: { fontWeight: 700, fontSize: 13, color: '#1a1a2e' },
  rtStepSub: { fontSize: 12, color: '#888', marginTop: 2 },
  rtCheck: { marginLeft: 'auto', color: '#007744', fontWeight: 900, fontSize: 18 },
  rtArrow: { color: '#99aadd', fontSize: 20, fontWeight: 700, flexShrink: 0 },

  resultsHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 },
  resultsTitle: { fontSize: 18, fontWeight: 700, color: '#003399', fontFamily: 'Montserrat, sans-serif' },
  backStepBtn: {
    background: '#f0f4ff', color: '#003399', border: '2px solid #dde4ff',
    padding: '8px 18px', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600,
  },
  flightsList: { display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 32 },
  loadMoreBtn: {
    display: 'block', width: '100%', padding: '14px 0', marginTop: 8,
    background: 'white', color: '#003399', border: '2px solid #dde4ff',
    borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: 'pointer',
    transition: 'all 0.2s',
  },
  flightCard: {
    background: 'white', borderRadius: 16, padding: '24px 28px',
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    boxShadow: '0 4px 20px rgba(0,51,153,0.08)', gap: 24, transition: 'border 0.2s',
  },
  flightLeft: { flex: 1, display: 'flex', alignItems: 'center', gap: 32 },
  airline: { display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 },
  airlineIcon: { fontSize: 28 },
  flightNum: { fontWeight: 800, color: '#003399', fontSize: 16, fontFamily: 'Montserrat, sans-serif' },
  aircraft: { color: '#888', fontSize: 12, marginTop: 2 },
  route: { display: 'flex', alignItems: 'center', gap: 24 },
  routePoint: { textAlign: 'center' },
  time: { fontSize: 22, fontWeight: 800, color: '#1a1a2e', fontFamily: 'Montserrat, sans-serif' },
  code: { fontSize: 14, fontWeight: 700, color: '#003399', marginTop: 2 },
  city: { fontSize: 11, color: '#888', marginTop: 2 },
  routeMiddle: { textAlign: 'center', minWidth: 100 },
  duration: { fontSize: 12, color: '#888', marginBottom: 4, fontWeight: 600 },
  routeLine: { height: 2, background: 'linear-gradient(90deg, #003399, #0066ff)', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '4px 0' },
  planeDot: { fontSize: 14, color: '#003399', background: 'white', padding: '0 4px' },
  direct: { fontSize: 11, color: '#007744', fontWeight: 600 },
  date: { color: '#888', fontSize: 13, flexShrink: 0 },
  flightRight: { textAlign: 'center', flexShrink: 0, minWidth: 140 },
  seatsInfo: { marginBottom: 8 },
  price: { fontSize: 28, fontWeight: 900, color: '#ff6600', fontFamily: 'Montserrat, sans-serif' },
  perPerson: { color: '#888', fontSize: 12, marginBottom: 16 },
  soldOutBadge: {
    display: 'inline-block',
    background: '#cc2222', color: 'white',
    fontWeight: 900, fontSize: 13, letterSpacing: 1,
    padding: '5px 14px', borderRadius: 20,
    marginBottom: 6, textTransform: 'uppercase',
  },
  soldOutSub: { color: '#cc2222', fontSize: 11, fontWeight: 600, marginBottom: 8 },

  // Confirm round trip card
  confirmCard: {
    background: 'white', borderRadius: 20, padding: '36px',
    boxShadow: '0 8px 40px rgba(0,51,153,0.12)', border: '2px solid #dde4ff',
  },
  confirmTitle: { fontFamily: 'Montserrat, sans-serif', fontSize: 22, fontWeight: 800, color: '#003399', marginBottom: 28 },
  confirmLegs: { display: 'flex', gap: 20, alignItems: 'center', marginBottom: 28, flexWrap: 'wrap' },
  confirmLeg: { flex: 1, background: '#f0f4ff', borderRadius: 14, padding: '20px 24px', minWidth: 220 },
  legHeader: { fontSize: 12, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 },
  legRoute: { fontSize: 22, fontWeight: 900, color: '#003399', fontFamily: 'Montserrat, sans-serif', marginBottom: 6 },
  legDetail: { fontSize: 13, color: '#666', marginBottom: 12 },
  legPrice: { fontSize: 20, fontWeight: 800, color: '#ff6600' },
  confirmLegDivider: { fontSize: 28, fontWeight: 900, color: '#99aadd', flexShrink: 0 },
  confirmTotal: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '20px 24px', background: '#fff8e1', borderRadius: 12,
    border: '2px solid #ffd54f', marginBottom: 24, fontWeight: 700, fontSize: 16, color: '#333',
  },
  confirmActions: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 },
  passengerPicker: {
    display: 'flex', alignItems: 'center', gap: 0,
    background: 'rgba(255,255,255,0.15)', borderRadius: 10,
    border: '1.5px solid rgba(255,255,255,0.3)', overflow: 'hidden',
    height: 42,
  },
  pickerBtn: {
    background: 'none', border: 'none', color: 'white',
    width: 36, height: '100%', fontSize: 20, fontWeight: 700,
    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  pickerVal: {
    color: 'white', fontWeight: 800, fontSize: 17,
    minWidth: 32, textAlign: 'center',
  },
  emptyState: {
    textAlign: 'center', padding: '80px 20px', background: 'white',
    borderRadius: 16, border: '1px solid #dde4ff',
  },
  sortBar: {
    display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
    background: 'white', borderRadius: 12, padding: '12px 18px',
    border: '1px solid #dde4ff', boxShadow: '0 2px 10px rgba(0,51,153,0.05)',
    marginBottom: 16,
  },
  sortBtn: {
    padding: '7px 14px', borderRadius: 8, border: '1.5px solid #dde4ff',
    background: '#f8faff', color: '#555', fontSize: 12, fontWeight: 600,
    cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'Inter, sans-serif',
  },
  sortBtnActive: {
    background: '#003399', color: 'white', borderColor: '#003399',
  },
  sortClearBtn: {
    padding: '7px 12px', borderRadius: 8, border: '1.5px solid #ffaaaa',
    background: '#fff0f0', color: '#cc2222', fontSize: 12, fontWeight: 600,
    cursor: 'pointer', fontFamily: 'Inter, sans-serif',
  },
};

export default FlightSearch;
