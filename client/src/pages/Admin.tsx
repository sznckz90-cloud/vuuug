import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  withdrawBalance: string;
  totalEarnings: string;
  adsWatched: number;
  dailyAdsWatched: number;
  level: number;
  flagged: boolean;
  banned: boolean;
  createdAt: string;
}

interface Withdrawal {
  id: string;
  userId: string;
  amount: string;
  method: string;
  status: string;
  details: any;
  transactionHash?: string;
  adminNotes?: string;
  createdAt: string;
  user?: {
    firstName: string;
    lastName: string;
    email: string;
  };
}

interface AdminStats {
  totalUsers: number;
  totalEarnings: string;
  totalWithdrawals: string;
  pendingWithdrawals: number;
  dailyActiveUsers: number;
  totalAdsWatched: number;
}

export default function AdminPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedWithdrawal, setSelectedWithdrawal] = useState<Withdrawal | null>(null);
  const [updateData, setUpdateData] = useState({
    status: '',
    transactionHash: '',
    adminNotes: ''
  });

  // Fetch admin stats
  const { data: stats } = useQuery<AdminStats>({
    queryKey: ["/api/admin/stats"],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Fetch all users
  const { data: users } = useQuery<User[]>({
    queryKey: ["/api/admin/users"],
    refetchInterval: 60000, // Refresh every minute
  });

  // Fetch withdrawals
  const { data: withdrawals } = useQuery<Withdrawal[]>({
    queryKey: ["/api/admin/withdrawals"],
    refetchInterval: 10000, // Refresh every 10 seconds
  });

  // Update withdrawal mutation
  const updateWithdrawalMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: string; status: string; transactionHash?: string; adminNotes?: string }) => {
      const response = await apiRequest("POST", `/api/admin/withdrawals/${id}/update`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/withdrawals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      setSelectedWithdrawal(null);
      setUpdateData({ status: '', transactionHash: '', adminNotes: '' });
      toast({
        title: "Success",
        description: "Withdrawal updated successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to update withdrawal",
        variant: "destructive",
      });
    },
  });

  // Ban/unban user mutation
  const toggleUserBanMutation = useMutation({
    mutationFn: async ({ userId, banned }: { userId: string; banned: boolean }) => {
      const response = await apiRequest("POST", `/api/admin/users/${userId}/ban`, { banned });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({
        title: "Success",
        description: "User status updated successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to update user status",
        variant: "destructive",
      });
    },
  });

  const handleUpdateWithdrawal = () => {
    if (!selectedWithdrawal || !updateData.status) return;
    
    updateWithdrawalMutation.mutate({
      id: selectedWithdrawal.id,
      ...updateData
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-500';
      case 'processing': return 'bg-blue-500';
      case 'completed': return 'bg-green-500';
      case 'failed': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Admin Dashboard</h1>
        <Badge variant="outline" className="text-sm">
          Admin Panel v1.0
        </Badge>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">Total Users</div>
            <div className="text-2xl font-bold">{stats?.totalUsers || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">Total Earnings</div>
            <div className="text-2xl font-bold">${stats?.totalEarnings || '0'}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">Total Withdrawals</div>
            <div className="text-2xl font-bold">${stats?.totalWithdrawals || '0'}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">Pending Withdrawals</div>
            <div className="text-2xl font-bold text-yellow-600">{stats?.pendingWithdrawals || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">Daily Active</div>
            <div className="text-2xl font-bold">{stats?.dailyActiveUsers || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">Ads Watched</div>
            <div className="text-2xl font-bold">{stats?.totalAdsWatched || 0}</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="withdrawals" className="space-y-4">
        <TabsList>
          <TabsTrigger value="withdrawals">Withdrawals</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="earnings">Earnings</TabsTrigger>
        </TabsList>

        {/* Withdrawals Tab */}
        <TabsContent value="withdrawals" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Withdrawal Management</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {withdrawals?.map((withdrawal) => (
                  <div
                    key={withdrawal.id}
                    className={`border rounded-lg p-4 ${selectedWithdrawal?.id === withdrawal.id ? 'border-primary' : 'border-border'}`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h3 className="font-semibold">
                          {withdrawal.user?.firstName} {withdrawal.user?.lastName}
                        </h3>
                        <p className="text-sm text-muted-foreground">ID: {withdrawal.userId}</p>
                      </div>
                      <Badge className={getStatusColor(withdrawal.status)}>
                        {withdrawal.status}
                      </Badge>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm mb-3">
                      <div>
                        <span className="text-muted-foreground">Amount: </span>
                        <span className="font-medium">${withdrawal.amount}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Method: </span>
                        <span className="font-medium">
                          {withdrawal.method === 'usdt_polygon' ? 'USDT (Polygon)' : 'Litecoin (LTC)'}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Created: </span>
                        <span className="font-medium">
                          {new Date(withdrawal.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Address: </span>
                        <span className="font-medium text-xs">
                          {JSON.stringify(withdrawal.details)}
                        </span>
                      </div>
                    </div>

                    {withdrawal.transactionHash && (
                      <div className="text-sm mb-2">
                        <span className="text-muted-foreground">TX Hash: </span>
                        <span className="font-mono text-xs">{withdrawal.transactionHash}</span>
                      </div>
                    )}

                    {withdrawal.adminNotes && (
                      <div className="text-sm mb-2">
                        <span className="text-muted-foreground">Notes: </span>
                        <span>{withdrawal.adminNotes}</span>
                      </div>
                    )}

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedWithdrawal(withdrawal);
                        setUpdateData({
                          status: withdrawal.status,
                          transactionHash: withdrawal.transactionHash || '',
                          adminNotes: withdrawal.adminNotes || ''
                        });
                      }}
                    >
                      Update
                    </Button>
                  </div>
                ))}
              </div>

              {/* Update Modal */}
              {selectedWithdrawal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                  <Card className="w-full max-w-md">
                    <CardHeader>
                      <CardTitle>Update Withdrawal</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <label className="text-sm font-medium">Status</label>
                        <Select value={updateData.status} onValueChange={(value) => setUpdateData({...updateData, status: value})}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pending">Pending</SelectItem>
                            <SelectItem value="processing">Processing</SelectItem>
                            <SelectItem value="completed">Completed</SelectItem>
                            <SelectItem value="failed">Failed</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div>
                        <label className="text-sm font-medium">Transaction Hash</label>
                        <Input
                          value={updateData.transactionHash}
                          onChange={(e) => setUpdateData({...updateData, transactionHash: e.target.value})}
                          placeholder="Enter transaction hash"
                        />
                      </div>
                      
                      <div>
                        <label className="text-sm font-medium">Admin Notes</label>
                        <Textarea
                          value={updateData.adminNotes}
                          onChange={(e) => setUpdateData({...updateData, adminNotes: e.target.value})}
                          placeholder="Enter admin notes"
                        />
                      </div>
                      
                      <div className="flex gap-2">
                        <Button onClick={handleUpdateWithdrawal} disabled={!updateData.status}>
                          Update
                        </Button>
                        <Button variant="outline" onClick={() => setSelectedWithdrawal(null)}>
                          Cancel
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Users Tab */}
        <TabsContent value="users" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>User Management</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {users?.map((user) => (
                  <div key={user.id} className="border rounded-lg p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h3 className="font-semibold">
                          {user.firstName} {user.lastName}
                        </h3>
                        <p className="text-sm text-muted-foreground">{user.email}</p>
                        <p className="text-xs text-muted-foreground">ID: {user.id}</p>
                      </div>
                      <div className="flex gap-2">
                        {user.banned && <Badge variant="destructive">Banned</Badge>}
                        {user.flagged && <Badge variant="secondary">Flagged</Badge>}
                        <Badge variant="outline">Level {user.level}</Badge>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm mb-3">
                      <div>
                        <span className="text-muted-foreground">Balance: </span>
                        <span className="font-medium">${user.withdrawBalance}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Total Earned: </span>
                        <span className="font-medium">${user.totalEarnings}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Ads Watched: </span>
                        <span className="font-medium">{user.adsWatched}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Joined: </span>
                        <span className="font-medium">
                          {new Date(user.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        variant={user.banned ? "default" : "destructive"}
                        size="sm"
                        onClick={() => toggleUserBanMutation.mutate({ userId: user.id, banned: !user.banned })}
                      >
                        {user.banned ? "Unban" : "Ban"} User
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Earnings Tab */}
        <TabsContent value="earnings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Earnings Overview</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <p className="text-muted-foreground">Earnings analytics coming soon...</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}