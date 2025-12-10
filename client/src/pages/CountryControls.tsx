import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAdmin } from "@/hooks/useAdmin";
import Layout from "@/components/Layout";
import { Link } from "wouter";
import { Globe, Search, ArrowLeft, Shield, MapPin } from "lucide-react";

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
    refetchInterval: 30000,
  });

  const { data: blockedData } = useQuery<{ success: boolean; blocked: string[] }>({
    queryKey: ["/api/blocked"],
    queryFn: () => fetch("/api/blocked").then(res => res.json()),
    enabled: isAdmin,
    refetchInterval: 30000,
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

  const handleToggle = async (countryCode: string, currentBlocked: boolean) => {
    setUpdatingCountries(prev => new Set(prev).add(countryCode));
    
    try {
      // Toggle OFF (currently allowed) → block the country
      // Toggle ON (currently blocked) → unblock the country
      const endpoint = currentBlocked ? '/api/unblock-country' : '/api/block-country';
      const response = await apiRequest('POST', endpoint, { country_code: countryCode });
      const result = await response.json();
      
      if (result.success) {
        // Refresh both queries to update UI
        queryClient.invalidateQueries({ queryKey: ["/api/countries"] });
        queryClient.invalidateQueries({ queryKey: ["/api/blocked"] });
        toast({
          title: currentBlocked ? "Country Unblocked" : "Country Blocked",
          description: "Saved",
        });
      } else {
        throw new Error(result.error || 'Failed to update country status');
      }
    } catch (error: any) {
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

  if (adminLoading) {
    return (
      <Layout>
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin text-primary text-3xl mb-4">
              <i className="fas fa-spinner"></i>
            </div>
            <div className="text-foreground font-medium">Loading...</div>
          </div>
        </div>
      </Layout>
    );
  }

  if (!isAdmin) {
    return (
      <Layout>
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="text-center">
            <div className="text-red-500 text-5xl mb-4">
              <i className="fas fa-exclamation-triangle"></i>
            </div>
            <h1 className="text-2xl font-bold text-foreground mb-2">Access Denied</h1>
            <p className="text-muted-foreground mb-4">You don't have permission to access this page.</p>
            <Link href="/">
              <Button>Return Home</Button>
            </Link>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <main className="max-w-4xl mx-auto px-4 pb-20 pt-3">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Link href="/admin">
              <Button variant="ghost" size="sm" className="h-8 px-2">
                <ArrowLeft className="w-4 h-4" />
              </Button>
            </Link>
            <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
              <Globe className="w-5 h-5 text-blue-500" />
              Country Controls
            </h1>
          </div>
          <Button 
            size="sm"
            variant="outline"
            onClick={() => {
              queryClient.invalidateQueries({ queryKey: ["/api/countries"] });
              queryClient.invalidateQueries({ queryKey: ["/api/blocked"] });
              queryClient.invalidateQueries({ queryKey: ["/api/user-info"] });
            }}
            className="h-8 px-3 text-xs"
          >
            <i className="fas fa-sync-alt"></i>
          </Button>
        </div>

        {userInfo && (
          <Card className="bg-[#121212] border-white/10 mb-4">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <MapPin className="w-5 h-5 text-green-500" />
                <div>
                  <div className="text-sm font-medium text-foreground">
                    Your Current Country: {userInfo.countryCode} ({userInfo.country})
                  </div>
                  <div className="text-xs text-muted-foreground">
                    IP: {userInfo.ip}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="bg-[#121212] border-white/10 mb-4">
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                  <Shield className="w-4 h-4" />
                  <span>Geo-Restriction Status</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {blockedCount === 0 
                    ? "All countries are currently allowed"
                    : `${blockedCount} ${blockedCount === 1 ? 'country' : 'countries'} blocked`
                  }
                </p>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-[#4cd3ff]">{countries.length}</div>
                <div className="text-xs text-muted-foreground">Total Countries</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#121212] border-white/10">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search countries..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-[#1a1a1a] border-white/10"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {countriesLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin text-primary text-2xl">
                  <i className="fas fa-spinner"></i>
                </div>
              </div>
            ) : (
              <div className="max-h-[500px] overflow-y-auto">
                {filteredCountries.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No countries found matching "{searchQuery}"
                  </div>
                ) : (
                  <div className="divide-y divide-white/5">
                    {filteredCountries.map(country => (
                      <div 
                        key={country.code}
                        className={`flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-colors ${country.blocked ? 'bg-red-500/5' : ''}`}
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-xl">
                            {getFlagEmoji(country.code)}
                          </span>
                          <div>
                            <p className="font-medium text-foreground">{country.name}</p>
                            <p className="text-xs text-muted-foreground">{country.code}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          {country.blocked && (
                            <span className="text-xs text-red-400 font-medium">Blocked</span>
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
            )}
          </CardContent>
        </Card>

        <div className="mt-4 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
          <p className="text-xs text-yellow-400">
            <strong>Note:</strong> When a country is blocked (toggle OFF), users from that country will see a "Not available in your country" screen and cannot access the mini app.
            The blocking works server-side based on IP detection.
          </p>
        </div>
      </main>
    </Layout>
  );
}

function getFlagEmoji(countryCode: string): string {
  const codePoints = countryCode
    .toUpperCase()
    .split('')
    .map(char => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}
