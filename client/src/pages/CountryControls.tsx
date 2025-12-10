import { useState, useMemo } from "react";
import { Switch } from "@/components/ui/switch";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useAdmin } from "@/hooks/useAdmin";
import Layout from "@/components/Layout";
import { Link } from "wouter";

interface Country {
  code: string;
  name: string;
  blocked: boolean;
}

interface UserInfo {
  ip: string;
  country: string;
  countryCode: string;
}

export default function CountryControlsPage() {
  const { toast } = useToast();
  const { isAdmin, isLoading: adminLoading } = useAdmin();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [updatingCountries, setUpdatingCountries] = useState<Set<string>>(new Set());

  const { data: countriesData, isLoading: countriesLoading } = useQuery<{ success: boolean; countries: { code: string; name: string }[] }>({
    queryKey: ["/api/countries"],
    queryFn: () => fetch("/api/countries").then(res => res.json()),
    enabled: isAdmin,
    refetchInterval: 5000,
  });

  const { data: blockedData, refetch: refetchBlocked } = useQuery<{ success: boolean; blocked: string[] }>({
    queryKey: ["/api/blocked"],
    queryFn: () => fetch("/api/blocked").then(res => res.json()),
    enabled: isAdmin,
    refetchInterval: 5000,
  });

  const { data: userInfo } = useQuery<UserInfo>({
    queryKey: ["/api/user-info"],
    queryFn: () => fetch("/api/user-info").then(res => res.json()),
    enabled: isAdmin,
    staleTime: 60000,
  });

  const blockedSet = useMemo(() => new Set(blockedData?.blocked || []), [blockedData]);
  
  const countries: Country[] = useMemo(() => {
    return (countriesData?.countries || []).map(c => ({
      code: c.code,
      name: c.name,
      blocked: blockedSet.has(c.code)
    }));
  }, [countriesData, blockedSet]);
  
  const filteredCountries = useMemo(() => {
    if (!searchQuery.trim()) return countries;
    const query = searchQuery.toLowerCase();
    return countries.filter(
      country => 
        country.name.toLowerCase().includes(query) || 
        country.code.toLowerCase().includes(query)
    );
  }, [countries, searchQuery]);

  const blockedCount = countries.filter(c => c.blocked).length;

  const handleToggle = async (countryCode: string, isCurrentlyBlocked: boolean) => {
    // Prevent double-clicks
    if (updatingCountries.has(countryCode)) {
      return;
    }
    
    setUpdatingCountries(prev => new Set(prev).add(countryCode));
    
    try {
      // Get Telegram data for admin authentication
      const tg = window.Telegram?.WebApp;
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      
      if (tg?.initData) {
        headers['x-telegram-data'] = tg.initData;
      }
      
      // If currently blocked, we need to unblock (allow)
      // If currently allowed (not blocked), we need to block
      const endpoint = isCurrentlyBlocked ? '/api/unblock-country' : '/api/block-country';
      
      console.log(`Toggle country ${countryCode}: currently blocked=${isCurrentlyBlocked}, calling ${endpoint}`);
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({ country_code: countryCode })
      });
      
      const result = await response.json();
      
      if (result.success) {
        // Immediately refetch blocked list to update UI
        await refetchBlocked();
        toast({
          title: isCurrentlyBlocked ? "Country Allowed" : "Country Blocked",
          description: `${countryCode} has been ${isCurrentlyBlocked ? 'allowed' : 'blocked'}`,
        });
      } else {
        throw new Error(result.error || 'Failed to update');
      }
    } catch (error: any) {
      console.error('Toggle error:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to update country status",
        variant: "destructive",
      });
    } finally {
      setUpdatingCountries(prev => {
        const newSet = new Set(prev);
        newSet.delete(countryCode);
        return newSet;
      });
    }
  };

  const getFlagEmoji = (countryCode: string): string => {
    const codePoints = countryCode
      .toUpperCase()
      .split('')
      .map(char => 127397 + char.charCodeAt(0));
    return String.fromCodePoint(...codePoints);
  };

  if (adminLoading) {
    return (
      <Layout>
        <div className="min-h-screen bg-black flex items-center justify-center">
          <div className="flex gap-1">
            <div className="w-2 h-2 rounded-full bg-white animate-bounce" style={{ animationDelay: '0ms' }}></div>
            <div className="w-2 h-2 rounded-full bg-white animate-bounce" style={{ animationDelay: '150ms' }}></div>
            <div className="w-2 h-2 rounded-full bg-white animate-bounce" style={{ animationDelay: '300ms' }}></div>
          </div>
        </div>
      </Layout>
    );
  }

  if (!isAdmin) {
    return (
      <Layout>
        <div className="min-h-screen bg-black flex items-center justify-center p-6">
          <div className="text-center max-w-sm">
            <div className="w-20 h-20 mx-auto mb-8 rounded-full border-2 border-white/20 flex items-center justify-center">
              <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h1 className="text-2xl font-semibold text-white mb-4">Access Denied</h1>
            <p className="text-white/50 text-sm mb-8">You don't have permission to access this page.</p>
            <Link href="/">
              <button className="px-6 py-3 bg-white text-black font-medium rounded-xl">
                Return Home
              </button>
            </Link>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <main className="min-h-screen bg-black pb-20">
        <div className="max-w-2xl mx-auto px-4 pt-4">
          <div className="flex items-center gap-4 mb-6">
            <Link href="/admin">
              <button className="w-10 h-10 rounded-full border border-white/10 flex items-center justify-center hover:bg-white/5 transition-colors">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            </Link>
            <h1 className="text-xl font-semibold text-white">Country Controls</h1>
          </div>

          {userInfo && (
            <div className="mb-4 p-4 bg-white/5 border border-white/10 rounded-xl">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <div>
                  <p className="text-white text-sm font-medium">
                    Your Location: {getFlagEmoji(userInfo.countryCode)} {userInfo.country}
                  </p>
                  <p className="text-white/40 text-xs">IP: {userInfo.ip}</p>
                </div>
              </div>
            </div>
          )}

          <div className="mb-4 p-4 bg-white/5 border border-white/10 rounded-xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/50 text-xs uppercase tracking-wider mb-1">Status</p>
                <p className="text-white text-sm">
                  {blockedCount === 0 ? "All countries allowed" : `${blockedCount} blocked`}
                </p>
              </div>
              <div className="text-right">
                <p className="text-3xl font-bold text-white">{countries.length}</p>
                <p className="text-white/40 text-xs">Countries</p>
              </div>
            </div>
          </div>

          <div className="mb-4">
            <div className="relative">
              <svg className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search countries..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/40 focus:outline-none focus:border-white/30"
              />
            </div>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
            {countriesLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="flex gap-1">
                  <div className="w-2 h-2 rounded-full bg-white animate-bounce" style={{ animationDelay: '0ms' }}></div>
                  <div className="w-2 h-2 rounded-full bg-white animate-bounce" style={{ animationDelay: '150ms' }}></div>
                  <div className="w-2 h-2 rounded-full bg-white animate-bounce" style={{ animationDelay: '300ms' }}></div>
                </div>
              </div>
            ) : filteredCountries.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-white/40 text-sm">No countries found</p>
              </div>
            ) : (
              <div className="max-h-[60vh] overflow-y-auto">
                {filteredCountries.map((country, index) => (
                  <div 
                    key={country.code}
                    className={`flex items-center justify-between px-4 py-3 ${
                      index !== filteredCountries.length - 1 ? 'border-b border-white/5' : ''
                    } ${country.blocked ? 'bg-red-500/5' : ''}`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{getFlagEmoji(country.code)}</span>
                      <div>
                        <p className="text-white text-sm font-medium">{country.name}</p>
                        <p className="text-white/40 text-xs">{country.code}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {country.blocked && (
                        <span className="text-xs text-red-400 font-medium px-2 py-1 bg-red-500/10 rounded">
                          Blocked
                        </span>
                      )}
                      <Switch
                        checked={!country.blocked}
                        onCheckedChange={() => handleToggle(country.code, country.blocked)}
                        disabled={updatingCountries.has(country.code)}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-4 p-4 bg-white/5 border border-white/10 rounded-xl">
            <p className="text-white/40 text-xs">
              <strong className="text-white/60">Note:</strong> Toggle OFF to block a country. 
              Users from blocked countries will see a "Not available" screen.
            </p>
          </div>
        </div>
      </main>
    </Layout>
  );
}
