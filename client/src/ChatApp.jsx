import { useState, useEffect, useRef } from "react";
import ChatBubble from "./ChatBubble";
import MessageInput from "./MessageInput";
import styles from "./ChatApp.module.css";

const API_BASE_URL = "https://stockai-5sf6.onrender.com";
const DUBLIN_DISTRICTS = Array.from({ length: 24 }, (_, i) => `Dublin ${i + 1}`);

export default function ChatApp() {
  const [chat, setChat] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("chatHistory")) || [];
    } catch {
      return [];
    }
  });
  const [message, setMessage] = useState("");
  const [lang, setLang] = useState("auto");
  const [loading, setLoading] = useState(false);
  const [itineraryLoading, setItineraryLoading] = useState(false);
  const [activeRequests, setActiveRequests] = useState(new Set());
  const [area, setArea] = useState(() => localStorage.getItem("area") || "Dublin 1");
  const [customArea, setCustomArea] = useState("");
  const [showPlanner, setShowPlanner] = useState(false);
  const [itinerary, setItinerary] = useState(null);
  const [plannerDays, setPlannerDays] = useState(3);
  const [plannerStart, setPlannerStart] = useState("");
  const [preferences, setPreferences] = useState({ interests: [], pace: "balanced" });
  const [showItinerary, setShowItinerary] = useState(false);
  const [userEmail, setUserEmail] = useState("");
  const [theme, setTheme] = useState(() => localStorage.getItem("theme") || "light");

  const chatContainerRef = useRef(null);
  const chatAbortController = useRef(null);
  const itineraryAbortController = useRef(null);

  // Persist chat and area; auto-scroll
  useEffect(() => {
    try {
      localStorage.setItem("chatHistory", JSON.stringify(chat));
    } catch {}
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chat]);

  useEffect(() => {
    try {
      localStorage.setItem("area", area);
    } catch {}
  }, [area]);

  useEffect(() => {
    document.body.dataset.theme = theme;
    try {
      localStorage.setItem("theme", theme);
    } catch {}
  }, [theme]);

  // Cleanup: Cancel any pending requests on unmount
  useEffect(() => {
    return () => {
      if (chatAbortController.current) {
        chatAbortController.current.abort();
      }
      if (itineraryAbortController.current) {
        itineraryAbortController.current.abort();
      }
    };
  }, []);

  const toggleTheme = () => setTheme((prev) => (prev === "light" ? "dark" : "light"));
  const resolvedArea = area === "Other" && customArea.trim() ? customArea.trim() : area;

  // Send message with streaming support
  const sendMessage = async (overrideMessages) => {
    const msgs = overrideMessages || chat;
    if (!message.trim() && !overrideMessages) return;

    // Cancel any existing chat request
    if (chatAbortController.current) {
      chatAbortController.current.abort();
    }

    // Create new abort controller for this request
    chatAbortController.current = new AbortController();

    const userMessage = overrideMessages ? null : { role: "user", content: message };
    const updatedChat = userMessage ? [...msgs, userMessage] : msgs;
    if (!overrideMessages) {
      setChat(updatedChat);
      setMessage("");
    }

    setLoading(true);
    setActiveRequests(prev => new Set(prev).add('chat'));
    setChat((prev) => [...prev, { role: "assistant", content: "" }]);

    try {
      const res = await fetch(`${API_BASE_URL}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: updatedChat, userLang: lang, area: resolvedArea }),
        signal: chatAbortController.current.signal,
      });

      if (!res.body) throw new Error("ReadableStream not supported or response body empty");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let assistantReply = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        assistantReply += decoder.decode(value, { stream: true });
        setChat((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: "assistant", content: assistantReply };
          return updated;
        });
      }
    } catch (err) {
      if (err.name === 'AbortError') {
        console.log('Chat request was cancelled');
        // Remove the empty assistant message if request was cancelled
        setChat((prev) => prev.slice(0, -1));
        return;
      }
      console.error("Chat API error:", err);
      setChat((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = { role: "assistant", content: "Sorry, something went wrong. Please try again." };
        return updated;
      });
    } finally {
      setLoading(false);
      setActiveRequests(prev => {
        const updated = new Set(prev);
        updated.delete('chat');
        return updated;
      });
      chatAbortController.current = null;
    }
  };

  const clearChat = () => {
    setChat([]);
    try {
      localStorage.removeItem("chatHistory");
    } catch {}
  };

  const sendCategoryPrompt = (category) => {
    const prompt = `In ${resolvedArea}, suggest the best ${category} with reasons and links.`;
    sendMessage([...chat, { role: "user", content: prompt }]);
    
    // Add visual feedback for category selection
    const button = event?.target;
    if (button) {
      button.style.transform = 'scale(0.95)';
      setTimeout(() => {
        button.style.transform = '';
      }, 150);
    }
    
    // Smooth scroll to chat section after a brief delay
    setTimeout(() => {
      const chatSection = document.querySelector('[data-chat-section]');
      if (chatSection) {
        chatSection.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'start' 
        });
        
        // Add a subtle highlight effect to the chat section
        chatSection.style.boxShadow = '0 0 30px rgba(255, 122, 89, 0.3)';
        setTimeout(() => {
          chatSection.style.boxShadow = '';
        }, 2000);
      }
    }, 300);
  };

  const handlePlannerSubmit = async (e) => {
    e?.preventDefault();
    
    // Cancel any existing itinerary request
    if (itineraryAbortController.current) {
      itineraryAbortController.current.abort();
    }

    // Create new abort controller for this request
    itineraryAbortController.current = new AbortController();
    
    setItinerary(null);
    setItineraryLoading(true);
    setActiveRequests(prev => new Set(prev).add('itinerary'));
    
    try {
      const res = await fetch(`${API_BASE_URL}/api/itinerary`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          area: resolvedArea,
          days: Number(plannerDays) || 3,
          startDate: plannerStart || undefined,
          preferences,
          userLang: lang,
        }),
        signal: itineraryAbortController.current.signal,
      });
      
      if (!res.ok) throw new Error("Failed to generate itinerary");
      
      const data = await res.json();
      setItinerary(data);
      setShowPlanner(false);
      setShowItinerary(true);
    } catch (err) {
      if (err.name === 'AbortError') {
        console.log('Itinerary request was cancelled');
        return;
      }
      console.error("itinerary error", err);
      alert("Failed to generate itinerary. Please try again.");
    } finally {
      setItineraryLoading(false);
      setActiveRequests(prev => {
        const updated = new Set(prev);
        updated.delete('itinerary');
        return updated;
      });
      itineraryAbortController.current = null;
    }
  };

  const quickLinks = {
    hotels: `https://www.booking.com/searchresults.html?ss=${encodeURIComponent(resolvedArea + ", Ireland")}`,
    tickets: `https://www.getyourguide.com/s/?q=${encodeURIComponent(resolvedArea)}&lc=l184`,
    food1: `https://www.just-eat.ie/`,
    food2: `https://deliveroo.ie/`,
    transport: `https://www.transportforireland.ie/plan-a-journey/`,
    maps: `https://www.google.com/maps/search/${encodeURIComponent("places in " + resolvedArea + ", Ireland")}`,
  };

  // Copy itinerary to clipboard
  const copyItinerary = async () => {
    if (!itinerary) return;
    
    const text = `${itinerary.title || 'Your Irish Adventure'}\n\n${itinerary.summary || ''}\n\n` +
      (itinerary.days || []).map(day => 
        `Day ${day.day}: ${day.title}\n` +
        (day.description ? `${day.description}\n` : '') +
        (day.items || []).map(item => 
          `• ${item.time ? item.time + ' - ' : ''}${item.name}${item.note ? ' - ' + item.note : ''}`
        ).join('\n')
      ).join('\n\n') +
      `\n\nGenerated by Ireland Travel Concierge`;
    
    try {
      await navigator.clipboard.writeText(text);
      alert('Itinerary copied to clipboard! 📋');
    } catch (err) {
      console.error('Failed to copy:', err);
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      alert('Itinerary copied to clipboard! 📋');
    }
  };

  // Email itinerary
  const emailItinerary = () => {
    if (!itinerary || !userEmail) return;
    
    const subject = encodeURIComponent(`Your Irish Adventure Itinerary - ${itinerary.title || resolvedArea}`);
    const body = encodeURIComponent(
      `Hi there!\n\nHere's your personalized Irish adventure itinerary:\n\n` +
      `${itinerary.title || 'Your Irish Adventure'}\n\n${itinerary.summary || ''}\n\n` +
      (itinerary.days || []).map(day => 
        `Day ${day.day}: ${day.title}\n` +
        (day.description ? `${day.description}\n` : '') +
        (day.items || []).map(item => 
          `• ${item.time ? item.time + ' - ' : ''}${item.name}${item.note ? ' - ' + item.note : ''}\n` +
          (item.map_url ? `  Map: ${item.map_url}\n` : '') +
          (item.official_url ? `  Website: ${item.official_url}\n` : '')
        ).join('')
      ).join('\n') +
      `\n\nEnjoy your trip to Ireland!\n\nGenerated by Ireland Travel Concierge\nhttps://ireland-travel-concierge.com`
    );
    
    const mailtoLink = `mailto:${userEmail}?subject=${subject}&body=${body}`;
    window.open(mailtoLink);
  };

  return (
    <div className={styles.app}>
      {/* Navigation Header */}
      <nav className={styles.nav}>
        <div className={styles.navContent}>
          <div className={styles.navLeft}>
            <h1 
              className={styles.logo}
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              style={{ cursor: 'pointer' }}
            >
              Ireland Travel Concierge
            </h1>
            <div className={styles.navLinks}>
              <a href="#home" className={styles.navLink}>Home</a>
              <a href="#destinations" className={styles.navLink}>Destinations</a>
              <a href="#experiences" className={styles.navLink}>Experiences</a>
              <a href="#about" className={styles.navLink}>About</a>
            </div>
          </div>
          <div className={styles.navRight}>
            {/* Active Request Indicators */}
            {activeRequests.size > 0 && (
              <div className={styles.activeIndicator}>
                <span className={styles.loadingDot}></span>
                {activeRequests.has('chat') && <span className={styles.requestType}>Chat</span>}
                {activeRequests.has('itinerary') && <span className={styles.requestType}>Planning</span>}
              </div>
            )}
            
            <button onClick={toggleTheme} className={styles.themeBtn}>
              {theme === "light" ? "🌙" : "☀️"}
            </button>
            <button onClick={clearChat} className={styles.clearBtn}>Clear Chat</button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className={styles.hero}>
        <div className={styles.heroContent}>
          <div className={styles.heroText}>
            <h2 className={styles.heroTitle}>Discover Ireland Like a Local</h2>
            <p className={styles.heroSubtitle}>
              Get personalized recommendations for hotels, restaurants, attractions, and experiences across Ireland's most vibrant areas.
            </p>
            
            <div className={styles.controls}>
              <div className={styles.controlGroup}>
                <label className={styles.label}>Select Area</label>
                <select 
                  className={styles.select} 
                  value={area} 
                  onChange={(e) => setArea(e.target.value)}
                >
                  {DUBLIN_DISTRICTS.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                  <option value="Other">Other Location</option>
                </select>
                {area === "Other" && (
                  <input
                    className={styles.input}
                    placeholder="Enter location (e.g., Galway City)"
                    value={customArea}
                    onChange={(e) => setCustomArea(e.target.value)}
                  />
                )}
              </div>
              
              <div className={styles.controlGroup}>
                <label className={styles.label}>Language</label>
                <select 
                  className={styles.select} 
                  value={lang} 
                  onChange={(e) => setLang(e.target.value)}
                >
                  <option value="auto">Auto Detect</option>
                  <option value="en">English</option>
                  <option value="es">Spanish</option>
                  <option value="fr">French</option>
                  <option value="de">German</option>
                  <option value="zh">Chinese</option>
                </select>
              </div>
              
              {/* Enhanced Plan Trip Button */}
              <div className={styles.planTripSection}>
                              <button 
                onClick={() => setShowPlanner(true)} 
                className={styles.planTripButton}
                disabled={loading || itineraryLoading}
              >
                  <span className={styles.planIcon}>✈️</span>
                  <span className={styles.planText}>Plan My Trip</span>
                  <span className={styles.planArrow}>→</span>
                </button>
                <p className={styles.planDescription}>
                  Create a personalized itinerary for your Irish adventure
                </p>
              </div>
            </div>
          </div>
          
          <div className={styles.heroImage}>
            <div className={styles.mapCard}>
              <h3>Explore {resolvedArea}</h3>
              <iframe
                title="Area Map"
                width="100%"
                height="300"
                style={{ border: 0, borderRadius: '12px' }}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                src={`https://www.google.com/maps?q=${encodeURIComponent(resolvedArea + ", Ireland")}&output=embed`}
              />
            </div>
          </div>
        </div>
      </section>

      {/* Quick Categories */}
      <section className={styles.categoriesSection}>
        <div className={styles.container}>
          <h3 className={styles.sectionTitle}>What are you looking for?</h3>
          <div className={styles.categoryGrid}>
            {[
              { name: "Hotels", emoji: "🏨", category: "hotels" },
              { name: "Restaurants", emoji: "🍽️", category: "restaurants" },
              { name: "Pubs & Nightlife", emoji: "🍺", category: "pubs and nightlife" },
              { name: "Attractions", emoji: "🏛️", category: "attractions" },
              { name: "Day Trips", emoji: "🚌", category: "day trips" },
              { name: "Events", emoji: "🎭", category: "events" }
            ].map((item) => (
              <button 
                key={item.category}
                className={styles.categoryCard}
                onClick={() => sendCategoryPrompt(item.category)}
                disabled={loading}
              >
                <span className={styles.categoryEmoji}>{item.emoji}</span>
                <span className={styles.categoryName}>{item.name}</span>
              </button>
            ))}
          </div>
        </div>
      </section>



      {/* Enhanced Trip Planner Modal */}
      {showPlanner && (
        <div className={styles.modal} onClick={() => setShowPlanner(false)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>
                <span className={styles.modalIcon}>✈️</span>
                Plan Your Trip to {resolvedArea}
              </h3>
              <button onClick={() => setShowPlanner(false)} className={styles.closeBtn}>×</button>
            </div>
            <form onSubmit={handlePlannerSubmit} className={styles.plannerForm}>
              <div className={styles.formGrid}>
                <div className={styles.formGroup}>
                  <label className={styles.label}>
                    <span className={styles.labelIcon}>📅</span>
                    Number of Days
                  </label>
                  <input 
                    type="number" 
                    min="1" 
                    max="10" 
                    value={plannerDays} 
                    onChange={(e) => setPlannerDays(e.target.value)}
                    className={styles.input}
                    placeholder="How many days?"
                  />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.label}>
                    <span className={styles.labelIcon}>🗓️</span>
                    Start Date
                  </label>
                  <input 
                    type="date" 
                    value={plannerStart} 
                    onChange={(e) => setPlannerStart(e.target.value)}
                    className={styles.input}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.label}>
                    <span className={styles.labelIcon}>❤️</span>
                    Interests
                  </label>
                  <input
                    placeholder="e.g., museums, live music, food markets, history"
                    value={preferences.interests.join(", ")}
                    onChange={(e) => setPreferences((p) => ({ 
                      ...p, 
                      interests: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) 
                    }))}
                    className={styles.input}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.label}>
                    <span className={styles.labelIcon}>⚡</span>
                    Travel Pace
                  </label>
                  <select 
                    value={preferences.pace} 
                    onChange={(e) => setPreferences((p) => ({ ...p, pace: e.target.value }))}
                    className={styles.select}
                  >
                    <option value="relaxed">🌸 Relaxed & Leisurely</option>
                    <option value="balanced">⚖️ Balanced & Flexible</option>
                    <option value="packed">🚀 Action-Packed Adventure</option>
                  </select>
                </div>
              </div>
              <div className={styles.formActions}>
                <button type="button" onClick={() => setShowPlanner(false)} className={styles.secondaryBtn}>
                  Cancel
                </button>
                <button type="submit" disabled={itineraryLoading} className={styles.primaryBtn}>
                  <span className={styles.buttonIcon}>
                    {itineraryLoading ? "⏳" : "✨"}
                  </span>
                  {itineraryLoading ? "Creating Magic..." : "Create My Itinerary"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Enhanced Itinerary Display Modal */}
      {showItinerary && itinerary && (
        <div className={styles.modal} onClick={() => setShowItinerary(false)}>
          <div className={styles.itineraryModal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>
                <span className={styles.modalIcon}>🗓️</span>
                {itinerary.title || "Your Irish Adventure"}
              </h3>
              <button onClick={() => setShowItinerary(false)} className={styles.closeBtn}>×</button>
            </div>
            
            <div className={styles.itineraryContent}>
              {itinerary.summary && (
                <div className={styles.itinerarySummary}>
                  <p>{itinerary.summary}</p>
                </div>
              )}
              
              <div className={styles.itineraryDays}>
                {(itinerary.days || []).map((day) => (
                  <div key={day.day} className={styles.dayCard}>
                    <div className={styles.dayHeader}>
                      <h4>Day {day.day}: {day.title}</h4>
                      {day.description && <p className={styles.dayDescription}>{day.description}</p>}
                    </div>
                    <ul className={styles.dayItems}>
                      {(day.items || []).map((item, idx) => (
                        <li key={idx} className={styles.dayItem}>
                          <div className={styles.itemContent}>
                            <strong className={styles.itemName}>
                              {item.time && <span className={styles.itemTime}>{item.time}</span>}
                              {item.name}
                            </strong>
                            {item.note && <p className={styles.itemNote}>{item.note}</p>}
                          </div>
                          <div className={styles.itemLinks}>
                            {item.map_url && (
                              <a href={item.map_url} target="_blank" rel="noreferrer" className={styles.itemLink}>
                                📍 Map
                              </a>
                            )}
                            {item.official_url && (
                              <a href={item.official_url} target="_blank" rel="noreferrer" className={styles.itemLink}>
                                🌐 Website
                              </a>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
              
              {Array.isArray(itinerary.booking_suggestions) && itinerary.booking_suggestions.length > 0 && (
                <div className={styles.bookingSection}>
                  <h4 className={styles.bookingTitle}>📎 Recommended Booking Links</h4>
                  <div className={styles.bookingGrid}>
                    {itinerary.booking_suggestions.map((booking, i) => (
                      <a key={i} href={booking.url} target="_blank" rel="noreferrer" className={styles.bookingLink}>
                        {booking.label}
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
            
            {/* Email and Copy Actions */}
            <div className={styles.itineraryActions}>
              <div className={styles.emailSection}>
                <input
                  type="email"
                  placeholder="Enter your email to send itinerary"
                  value={userEmail}
                  onChange={(e) => setUserEmail(e.target.value)}
                  className={styles.emailInput}
                />
                <button 
                  onClick={emailItinerary}
                  disabled={!userEmail}
                  className={styles.emailBtn}
                >
                  <span className={styles.buttonIcon}>📧</span>
                  Email Itinerary
                </button>
              </div>
              
              <button onClick={copyItinerary} className={styles.copyBtn}>
                <span className={styles.buttonIcon}>📋</span>
                Copy to Clipboard
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content with Sidebar */}
      <section className={styles.mainContent}>
        <div className={styles.container}>
          <div className={styles.contentGrid}>
            {/* Sidebar with Quick Links */}
            <aside className={styles.sidebar}>
              <div className={styles.sidebarCard}>
                <h3 className={styles.sidebarTitle}>🚀 Quick Actions</h3>
                <div className={styles.quickLinksVertical}>
                  <a href={quickLinks.hotels} target="_blank" rel="noreferrer" className={styles.quickLinkSidebar}>
                    <div className={styles.linkIcon}>🏨</div>
                    <div className={styles.linkContent}>
                      <span className={styles.linkTitle}>Book Hotels</span>
                      <span className={styles.linkDesc}>Find & reserve accommodations</span>
                    </div>
                    <div className={styles.linkArrow}>→</div>
                  </a>
                  <a href={quickLinks.tickets} target="_blank" rel="noreferrer" className={styles.quickLinkSidebar}>
                    <div className={styles.linkIcon}>🎫</div>
                    <div className={styles.linkContent}>
                      <span className={styles.linkTitle}>Tours & Tickets</span>
                      <span className={styles.linkDesc}>Book experiences & attractions</span>
                    </div>
                    <div className={styles.linkArrow}>→</div>
                  </a>
                  <a href={quickLinks.food1} target="_blank" rel="noreferrer" className={styles.quickLinkSidebar}>
                    <div className={styles.linkIcon}>🍕</div>
                    <div className={styles.linkContent}>
                      <span className={styles.linkTitle}>Order Food</span>
                      <span className={styles.linkDesc}>Delivery to your location</span>
                    </div>
                    <div className={styles.linkArrow}>→</div>
                  </a>
                  <a href={quickLinks.transport} target="_blank" rel="noreferrer" className={styles.quickLinkSidebar}>
                    <div className={styles.linkIcon}>🚌</div>
                    <div className={styles.linkContent}>
                      <span className={styles.linkTitle}>Plan Transport</span>
                      <span className={styles.linkDesc}>Public transport routes</span>
                    </div>
                    <div className={styles.linkArrow}>→</div>
                  </a>
                  <a href={quickLinks.maps} target="_blank" rel="noreferrer" className={styles.quickLinkSidebar}>
                    <div className={styles.linkIcon}>🗺️</div>
                    <div className={styles.linkContent}>
                      <span className={styles.linkTitle}>View Maps</span>
                      <span className={styles.linkDesc}>Explore area locations</span>
                    </div>
                    <div className={styles.linkArrow}>→</div>
                  </a>
                  <button onClick={() => setShowPlanner(true)} className={styles.quickLinkSidebar}>
                    <div className={styles.linkIcon}>📅</div>
                    <div className={styles.linkContent}>
                      <span className={styles.linkTitle}>Plan Trip</span>
                      <span className={styles.linkDesc}>Generate custom itinerary</span>
                    </div>
                    <div className={styles.linkArrow}>→</div>
                  </button>
                </div>
              </div>
              
              {/* Weather Widget */}
              <div className={styles.sidebarCard}>
                <h3 className={styles.sidebarTitle}>🌤️ Dublin Weather</h3>
                <div className={styles.weatherWidget}>
                  <div className={styles.weatherIcon}>☁️</div>
                  <div className={styles.weatherInfo}>
                    <span className={styles.weatherTemp}>12°C</span>
                    <span className={styles.weatherDesc}>Cloudy</span>
                  </div>
                </div>
              </div>
            </aside>

            {/* Chat Section */}
            <main className={styles.chatSection} data-chat-section>
              <h3 className={styles.sectionTitle}>Chat with Ireland Travel Concierge</h3>
              <div className={styles.chatContainer}>
                <div className={styles.chatMessages} ref={chatContainerRef}>
                  {chat.length === 0 ? (
                    <div className={styles.chatPlaceholder}>
                      <div className={styles.placeholderAvatar}>🇮🇪</div>
                      <h4>👋 Hello! I'm your Ireland Travel Concierge</h4>
                      <p>Ask me about hotels, restaurants, attractions, or anything else about traveling in {resolvedArea}!</p>
                      <div className={styles.suggestedQuestions}>
                        <button onClick={() => sendCategoryPrompt("hotels")} className={styles.suggestedBtn}>
                          What are the best hotels?
                        </button>
                        <button onClick={() => sendCategoryPrompt("restaurants")} className={styles.suggestedBtn}>
                          Recommend restaurants
                        </button>
                        <button onClick={() => sendCategoryPrompt("attractions")} className={styles.suggestedBtn}>
                          Show me attractions
                        </button>
                      </div>
                    </div>
                  ) : (
                    chat.map(({ role, content }, idx) => (
                      <ChatBubble key={idx} role={role} content={content} />
                    ))
                  )}
                </div>
                <div className={styles.chatInput}>
                  <MessageInput
                    message={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onSend={() => sendMessage()}
                    loading={loading}
                  />
                </div>
              </div>
            </main>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className={styles.footer}>
        <div className={styles.container}>
          <p>&copy; 2024 Ireland Travel Concierge. Discover Ireland like never before.</p>
        </div>
      </footer>
    </div>
  );
}