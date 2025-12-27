import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, UserPlus, Trash2, Users } from "lucide-react";

interface CompanyUsersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
  companyName: string;
  onSuccess?: () => void;
}

interface CompanyUser {
  id: string;
  user_id: string;
  is_default: boolean;
  profile: {
    id: string;
    full_name: string | null;
    email: string | null;
  } | null;
}

interface AvailableUser {
  id: string;
  full_name: string | null;
  email: string | null;
}

export function CompanyUsersDialog({
  open,
  onOpenChange,
  companyId,
  companyName,
  onSuccess,
}: CompanyUsersDialogProps) {
  const [users, setUsers] = useState<CompanyUser[]>([]);
  const [availableUsers, setAvailableUsers] = useState<AvailableUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string>("");

  const fetchUsers = async () => {
    setLoading(true);
    try {
      // Fetch user_organizations for this company
      const { data: orgUsers, error: orgError } = await supabase
        .from("user_organizations")
        .select("id, user_id, is_default")
        .eq("organization_id", companyId);

      if (orgError) throw orgError;

      // Fetch profiles for all user_ids
      const userIds = (orgUsers || []).map((u) => u.user_id);
      
      let profilesMap: Record<string, { id: string; full_name: string | null; email: string | null }> = {};
      
      if (userIds.length > 0) {
        const { data: profiles, error: profilesError } = await supabase
          .from("profiles")
          .select("id, full_name, email")
          .in("id", userIds);

        if (profilesError) throw profilesError;

        profilesMap = (profiles || []).reduce((acc, p) => {
          acc[p.id] = p;
          return acc;
        }, {} as typeof profilesMap);
      }

      // Combine the data
      const usersWithProfiles: CompanyUser[] = (orgUsers || []).map((u) => ({
        id: u.id,
        user_id: u.user_id,
        is_default: u.is_default ?? false,
        profile: profilesMap[u.user_id] || null,
      }));

      setUsers(usersWithProfiles);

      // Fetch all profiles to find available users
      const { data: allProfiles, error: allProfilesError } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .order("full_name");

      if (allProfilesError) throw allProfilesError;

      // Filter out users already in this company
      const existingUserIds = new Set(userIds);
      const available = (allProfiles || []).filter(
        (p) => !existingUserIds.has(p.id)
      );
      setAvailableUsers(available);
    } catch (error: any) {
      console.error("Error fetching users:", error);
      toast.error("Erro ao carregar usuários");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      fetchUsers();
      setSelectedUserId("");
    }
  }, [open, companyId]);

  const handleAddUser = async () => {
    if (!selectedUserId) {
      toast.error("Selecione um usuário");
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.from("user_organizations").insert({
        user_id: selectedUserId,
        organization_id: companyId,
        is_default: false,
      });

      if (error) throw error;

      toast.success("Usuário adicionado com sucesso!");
      fetchUsers();
      setSelectedUserId("");
      onSuccess?.();
    } catch (error: any) {
      console.error("Error adding user:", error);
      toast.error(error.message || "Erro ao adicionar usuário");
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveUser = async (orgUserId: string, userName: string) => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("user_organizations")
        .delete()
        .eq("id", orgUserId);

      if (error) throw error;

      toast.success(`${userName || "Usuário"} removido da empresa`);
      fetchUsers();
      onSuccess?.();
    } catch (error: any) {
      console.error("Error removing user:", error);
      toast.error(error.message || "Erro ao remover usuário");
    } finally {
      setSaving(false);
    }
  };

  const handleDefaultChange = async (orgUserId: string, userId: string, isDefault: boolean) => {
    setSaving(true);
    try {
      if (isDefault) {
        // First, remove default from all other orgs for this user
        await supabase
          .from("user_organizations")
          .update({ is_default: false })
          .eq("user_id", userId);
      }

      const { error } = await supabase
        .from("user_organizations")
        .update({ is_default: isDefault })
        .eq("id", orgUserId);

      if (error) throw error;

      toast.success(isDefault ? "Empresa definida como padrão" : "Empresa removida como padrão");
      fetchUsers();
    } catch (error: any) {
      console.error("Error updating default:", error);
      toast.error(error.message || "Erro ao atualizar padrão");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Usuários - {companyName}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-auto space-y-4">
          {/* Add User Section */}
          <div className="bg-muted/50 rounded-lg p-4 space-y-3">
            <h3 className="text-sm font-medium flex items-center gap-2">
              <UserPlus className="h-4 w-4" />
              Adicionar Usuário
            </h3>
            <div className="flex gap-2">
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Selecione um usuário..." />
                </SelectTrigger>
                <SelectContent>
                  {availableUsers.length === 0 ? (
                    <SelectItem value="none" disabled>
                      Nenhum usuário disponível
                    </SelectItem>
                  ) : (
                    availableUsers.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.full_name || user.email || "Usuário sem nome"}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              <Button
                onClick={handleAddUser}
                disabled={!selectedUserId || saving}
                size="sm"
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <UserPlus className="h-4 w-4 mr-1" />
                    Adicionar
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Users List */}
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : users.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhum usuário vinculado a esta empresa</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuário</TableHead>
                  <TableHead className="text-center">Empresa Padrão</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">
                          {user.profile?.full_name || "Sem nome"}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          {user.profile?.email || "Sem email"}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Checkbox
                        checked={user.is_default}
                        onCheckedChange={(checked) =>
                          handleDefaultChange(user.id, user.user_id, !!checked)
                        }
                        disabled={saving}
                      />
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() =>
                          handleRemoveUser(
                            user.id,
                            user.profile?.full_name || ""
                          )
                        }
                        disabled={saving}
                        title="Remover usuário"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
