import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from "recharts";

interface PricePoint {
  time: string;
  price: string;
  totalAds: string;
  reason: string;
}

interface PriceHistoryResponse {
  success: boolean;
  data: PricePoint[];
  period: string;
}

const chartConfig = {
  price: {
    label: "PADZ Price (USDT)",
    color: "hsl(var(--primary))",
  },
};

interface PriceChartProps {
  className?: string;
}

export default function PriceChart({ className }: PriceChartProps) {
  const [selectedPeriod, setSelectedPeriod] = useState("24h");

  const { data: priceHistory, isLoading } = useQuery<PriceHistoryResponse>({
    queryKey: ["/api/price-history", selectedPeriod],
    queryFn: async () => {
      const response = await fetch(`/api/price-history?period=${selectedPeriod}`);
      if (!response.ok) {
        throw new Error('Failed to fetch price history');
      }
      return response.json();
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Transform data for chart
  const chartData = priceHistory?.data?.map((point: PricePoint, index: number) => ({
    time: new Date(point.time).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }),
    timestamp: point.time,
    price: Number(point.price),
    priceFormatted: Number(point.price).toFixed(8),
    totalAds: Number(point.totalAds),
    reason: point.reason
  })) || [];

  // Sample data with multiple points when no history is available
  const sampleData = chartData && chartData.length > 0 ? chartData : [
    { 
      time: "00:00", 
      timestamp: new Date().toISOString(),
      price: 0.00000317, 
      priceFormatted: "0.00000317",
      totalAds: 0,
      reason: "base"
    }
  ];

  const periods = [
    { label: "1H", value: "1h" },
    { label: "24H", value: "24h" },
    { label: "7D", value: "7d" },
    { label: "30D", value: "30d" },
  ];

  const currentPrice = sampleData[sampleData.length - 1]?.priceFormatted || "0.00000317";
  const previousPrice = sampleData[sampleData.length - 2]?.price || sampleData[0]?.price || 0.00000317;
  const priceChange = ((Number(currentPrice) - previousPrice) / previousPrice) * 100;
  const isPositive = priceChange >= 0;

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">PADZ/USDT Price Chart</CardTitle>
            <CardDescription>Live price movements based on global ad views</CardDescription>
          </div>
          <div className="flex gap-1">
            {periods.map((period) => (
              <Button
                key={period.value}
                variant={selectedPeriod === period.value ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedPeriod(period.value)}
                className="h-8 px-3"
              >
                {period.label}
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Current Price Display */}
        <div className="mb-4 p-3 bg-muted rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-2xl font-bold">${currentPrice}</div>
              <div className="text-sm text-muted-foreground">Current PADZ Price</div>
            </div>
            <div className={`text-right ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
              <div className="text-lg font-semibold">
                {isPositive ? '+' : ''}{priceChange.toFixed(4)}%
              </div>
              <div className="text-sm">24h Change</div>
            </div>
          </div>
        </div>

        {/* Chart */}
        <div className="h-64">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="animate-spin text-primary">
                <i className="fas fa-spinner text-2xl" style={{fontFamily: 'Font Awesome 5 Free', fontWeight: 900}}></i>
              </div>
            </div>
          ) : (
            <ChartContainer config={chartConfig}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={sampleData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis 
                    dataKey="time"
                    className="text-xs"
                    tick={{ fontSize: 12 }}
                  />
                  <YAxis 
                    domain={['dataMin - 0.00000001', 'dataMax + 0.00000001']}
                    tickFormatter={(value) => `$${value.toFixed(8)}`}
                    className="text-xs"
                    tick={{ fontSize: 12 }}
                  />
                  <ChartTooltip
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-background border border-border rounded-lg p-3 shadow-lg">
                            <div className="text-sm font-medium mb-1">
                              {new Date(data.timestamp).toLocaleString()}
                            </div>
                            <div className="text-lg font-bold text-primary">
                              ${data.priceFormatted}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              Total Ads: {data.totalAds.toLocaleString()}
                            </div>
                            <div className="text-xs text-muted-foreground capitalize">
                              Reason: {data.reason}
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="price"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4, fill: "hsl(var(--primary))" }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </ChartContainer>
          )}
        </div>

        {/* Chart Info */}
        <div className="mt-4 text-xs text-muted-foreground text-center">
          Price increases +3% every 1,000 global ads viewed • Updates in real-time
        </div>
      </CardContent>
    </Card>
  );
}