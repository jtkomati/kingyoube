import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Shield, UserPlus, Edit2, Trash2, Loader2, Crown, User, Calculator, Eye } from 'lucide-react';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';

type AppRole = 'SUPERADMIN' | 'ADMIN' | 'CONTADOR' | 'USUARIO';

interface UserWithRole {
  id: string;
  email: string;
  full_name: string;
  role: AppRole | null;
  role_id: string | null;
  created_at: string;
}

const roleConfig: Record<AppRole, { label: string; description: string; level: number; icon: React.ReactNode; color: string }> = {
  SUPERADMIN: {
    label: 'Super Admin',
    description: 'Acesso total ao sistema, incluindo configurações avançadas',
    level: 5,
    icon: <Crown className="h-4 w-4" />,
    color: 'bg-destructive text-destructive-foreground',
  },
  ADMIN: {
    label: 'Administrador',
    description: 'Gerencia usuários, configurações da empresa e relatórios',
    level: 4,
    icon: <Shield className="h-4 w-4" />,
    color: 'bg-primary text-primary-foreground',
  },
  CONTADOR: {
    label: 'Contador',
    description: 'Acesso a lançamentos contábeis, relatórios fiscais e financeiros',
    level: 3,
    icon: <Calculator className="h-4 w-4" />,
    color: 'bg-secondary text-secondary-foreground',
  },
  USUARIO: {
    label: 'Usuário',
    description: 'Acesso básico para visualização e operações do dia-a-dia',
    level: 1,
    icon: <User className="h-4 w-4" />,
    color: 'bg-muted text-muted-foreground',
  },
};

export function UserRolesTab() {
  const { user, userRole } = useAuth();
  const { toast } = useToast();
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserWithRole | null>(null);
  const [selectedRole, setSelectedRole] = useState<AppRole>('USUARIO');
  const [saving, setSaving] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<UserWithRole | null>(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      
      // Fetch profiles with their roles
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, email, full_name, created_at');

      if (profilesError) throw profilesError;

      // Fetch user roles
      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('id, user_id, role');

      if (rolesError) throw rolesError;

      // Combine data
      const usersWithRoles: UserWithRole[] = (profiles || []).map(profile => {
        const userRoleData = roles?.find(r => r.user_id === profile.id);
        return {
          id: profile.id,
          email: profile.email,
          full_name: profile.full_name,
          role: userRoleData?.role as AppRole | null,
          role_id: userRoleData?.id || null,
          created_at: profile.created_at,
        };
      });

      setUsers(usersWithRoles);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Não foi possível carregar os usuários.',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEditRole = (userToEdit: UserWithRole) => {
    setEditingUser(userToEdit);
    setSelectedRole(userToEdit.role || 'USUARIO');
    setDialogOpen(true);
  };

  const handleSaveRole = async () => {
    if (!editingUser) return;

    setSaving(true);
    try {
      if (editingUser.role_id) {
        // Update existing role
        const { error } = await supabase
          .from('user_roles')
          .update({ role: selectedRole })
          .eq('id', editingUser.role_id);

        if (error) throw error;
      } else {
        // Insert new role
        const { error } = await supabase
          .from('user_roles')
          .insert({
            user_id: editingUser.id,
            role: selectedRole,
          });

        if (error) throw error;
      }

      toast({
        title: 'Perfil atualizado',
        description: `O perfil de ${editingUser.full_name} foi atualizado para ${roleConfig[selectedRole].label}.`,
      });

      setDialogOpen(false);
      fetchUsers();
    } catch (error) {
      console.error('Error saving role:', error);
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Não foi possível atualizar o perfil.',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRole = async () => {
    if (!userToDelete?.role_id) return;

    try {
      const { error } = await supabase
        .from('user_roles')
        .delete()
        .eq('id', userToDelete.role_id);

      if (error) throw error;

      toast({
        title: 'Perfil removido',
        description: `O perfil de ${userToDelete.full_name} foi removido.`,
      });

      setDeleteDialogOpen(false);
      setUserToDelete(null);
      fetchUsers();
    } catch (error) {
      console.error('Error deleting role:', error);
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Não foi possível remover o perfil.',
      });
    }
  };

  const canManageUser = (targetUser: UserWithRole) => {
    // Superadmin can manage everyone except themselves for certain actions
    if (userRole === 'SUPERADMIN') return true;
    // Admin can manage users with lower level
    if (userRole === 'ADMIN') {
      const targetLevel = targetUser.role ? roleConfig[targetUser.role]?.level || 0 : 0;
      return targetLevel < 4;
    }
    return false;
  };

  const getRoleBadge = (role: AppRole | null) => {
    if (!role) {
      return <Badge variant="outline" className="gap-1"><Eye className="h-3 w-3" /> Sem perfil</Badge>;
    }
    const config = roleConfig[role];
    return (
      <Badge className={`gap-1 ${config.color}`}>
        {config.icon}
        {config.label}
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Role Hierarchy Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Hierarquia de Perfis
          </CardTitle>
          <CardDescription>
            Entenda os níveis de acesso disponíveis no sistema
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {(Object.entries(roleConfig) as [AppRole, typeof roleConfig[AppRole]][]).map(([role, config]) => (
              <Card key={role} className="border-l-4" style={{ borderLeftColor: `hsl(var(--${role === 'SUPERADMIN' ? 'destructive' : role === 'ADMIN' ? 'primary' : 'muted-foreground'}))` }}>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2 mb-2">
                    {config.icon}
                    <span className="font-medium">{config.label}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{config.description}</p>
                  <div className="mt-2">
                    <Badge variant="outline" className="text-xs">Nível {config.level}</Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle>Usuários e Perfis</CardTitle>
          <CardDescription>
            Gerencie os perfis de acesso dos usuários do sistema
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Perfil</TableHead>
                <TableHead>Cadastro</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((userItem) => (
                <TableRow key={userItem.id}>
                  <TableCell className="font-medium">{userItem.full_name}</TableCell>
                  <TableCell>{userItem.email}</TableCell>
                  <TableCell>{getRoleBadge(userItem.role)}</TableCell>
                  <TableCell>{new Date(userItem.created_at).toLocaleDateString('pt-BR')}</TableCell>
                  <TableCell className="text-right">
                    {canManageUser(userItem) && userItem.id !== user?.id && (
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditRole(userItem)}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        {userItem.role_id && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            onClick={() => {
                              setUserToDelete(userItem);
                              setDeleteDialogOpen(true);
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    )}
                    {userItem.id === user?.id && (
                      <Badge variant="outline">Você</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Edit Role Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Perfil de Acesso</DialogTitle>
            <DialogDescription>
              Altere o nível de acesso de {editingUser?.full_name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Usuário</Label>
              <Input value={editingUser?.full_name || ''} disabled />
            </div>
            <div className="space-y-2">
              <Label>Perfil de Acesso</Label>
              <Select value={selectedRole} onValueChange={(v) => setSelectedRole(v as AppRole)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.entries(roleConfig) as [AppRole, typeof roleConfig[AppRole]][]).map(([role, config]) => (
                    <SelectItem key={role} value={role} disabled={userRole !== 'SUPERADMIN' && role === 'SUPERADMIN'}>
                      <div className="flex items-center gap-2">
                        {config.icon}
                        <span>{config.label}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {roleConfig[selectedRole].description}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveRole} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <ConfirmationDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Remover Perfil"
        description={`Tem certeza que deseja remover o perfil de ${userToDelete?.full_name}? O usuário perderá todas as permissões.`}
        confirmText="Remover"
        onConfirm={handleDeleteRole}
        variant="destructive"
      />
    </div>
  );
}
