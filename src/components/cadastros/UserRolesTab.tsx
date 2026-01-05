import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Shield, Edit2, Trash2, Loader2, Crown, User, Calculator, Eye, Phone, MessageCircle } from 'lucide-react';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';

type AppRole = 'SUPERADMIN' | 'ADMIN' | 'CONTADOR' | 'USUARIO';

interface UserWithRole {
  id: string;
  email: string;
  full_name: string;
  phone_number: string | null;
  whatsapp_enabled: boolean;
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

// Formatar telefone para exibição
function formatPhoneDisplay(phone: string | null): string {
  if (!phone) return '—';
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 13) {
    return `+${digits.slice(0, 2)} ${digits.slice(2, 4)} ${digits.slice(4, 9)}-${digits.slice(9)}`;
  }
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  return phone;
}

export function UserRolesTab() {
  const { user, userRole } = useAuth();
  const { toast } = useToast();
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserWithRole | null>(null);
  const [selectedRole, setSelectedRole] = useState<AppRole>('USUARIO');
  const [editPhone, setEditPhone] = useState('');
  const [editWhatsappEnabled, setEditWhatsappEnabled] = useState(false);
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
        .select('id, email, full_name, phone_number, whatsapp_enabled, created_at');

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
          phone_number: profile.phone_number,
          whatsapp_enabled: profile.whatsapp_enabled || false,
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
    setEditPhone(userToEdit.phone_number || '');
    setEditWhatsappEnabled(userToEdit.whatsapp_enabled);
    setDialogOpen(true);
  };

  const handleSaveRole = async () => {
    if (!editingUser) return;

    const isEditingSelf = editingUser.id === user?.id;

    // Validar telefone se WhatsApp estiver habilitado
    if (editWhatsappEnabled && !editPhone.trim()) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Telefone é obrigatório para habilitar acesso WhatsApp.',
      });
      return;
    }

    setSaving(true);
    try {
      // Atualizar profile (telefone e whatsapp_enabled)
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          phone_number: editPhone.trim() || null,
          whatsapp_enabled: editWhatsappEnabled,
        })
        .eq('id', editingUser.id);

      if (profileError) throw profileError;

      // Atualizar role - apenas se não estiver editando a si mesmo
      if (!isEditingSelf) {
        if (editingUser.role_id) {
          const { error } = await supabase
            .from('user_roles')
            .update({ role: selectedRole })
            .eq('id', editingUser.role_id);

          if (error) throw error;
        } else {
          const { error } = await supabase
            .from('user_roles')
            .insert({
              user_id: editingUser.id,
              role: selectedRole,
            });

          if (error) throw error;
        }
      }

      toast({
        title: 'Perfil atualizado',
        description: `O perfil de ${editingUser.full_name} foi atualizado.`,
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
    if (userRole === 'SUPERADMIN') return true;
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
                <TableHead>Telefone</TableHead>
                <TableHead className="text-center">WhatsApp</TableHead>
                <TableHead>Perfil</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((userItem) => (
                <TableRow key={userItem.id}>
                  <TableCell className="font-medium">{userItem.full_name}</TableCell>
                  <TableCell>{userItem.email}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Phone className="h-3 w-3 text-muted-foreground" />
                      <span className="text-sm">{formatPhoneDisplay(userItem.phone_number)}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    {userItem.whatsapp_enabled ? (
                      <Badge variant="default" className="gap-1 bg-green-600 hover:bg-green-700">
                        <MessageCircle className="h-3 w-3" />
                        Ativo
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="gap-1">
                        <MessageCircle className="h-3 w-3" />
                        Inativo
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>{getRoleBadge(userItem.role)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end items-center gap-2">
                      {userItem.id === user?.id && (
                        <Badge variant="outline">Você</Badge>
                      )}
                      {(canManageUser(userItem) || userItem.id === user?.id) && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditRole(userItem)}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                      )}
                      {canManageUser(userItem) && userItem.id !== user?.id && userItem.role_id && (
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
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Edit Role Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Perfil de Acesso</DialogTitle>
            <DialogDescription>
              Altere o nível de acesso e configurações de {editingUser?.full_name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <div className="space-y-2">
              <Label>Usuário</Label>
              <Input value={editingUser?.full_name || ''} disabled />
            </div>
            
            <div className="space-y-2">
              <Label>Perfil de Acesso</Label>
              <Select 
                value={selectedRole} 
                onValueChange={(v) => setSelectedRole(v as AppRole)}
                disabled={editingUser?.id === user?.id}
              >
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
              {editingUser?.id === user?.id ? (
                <p className="text-xs text-amber-600">
                  Você não pode alterar seu próprio perfil de acesso
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  {roleConfig[selectedRole].description}
                </p>
              )}
            </div>

            <div className="border-t pt-4 space-y-4">
              <div className="flex items-center gap-2">
                <MessageCircle className="h-4 w-4 text-muted-foreground" />
                <Label className="text-sm font-medium">Acesso WhatsApp</Label>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="phone">Telefone</Label>
                <Input 
                  id="phone"
                  placeholder="+55 11 99999-9999"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Formato recomendado: +55 11 99999-9999
                </p>
              </div>

              <div className="flex items-center justify-between rounded-lg border p-3">
                <div className="space-y-0.5">
                  <Label htmlFor="whatsapp-toggle">Habilitar WhatsApp</Label>
                  <p className="text-xs text-muted-foreground">
                    Permite consultas financeiras via WhatsApp/n8n
                  </p>
                </div>
                <Switch
                  id="whatsapp-toggle"
                  checked={editWhatsappEnabled}
                  onCheckedChange={setEditWhatsappEnabled}
                  disabled={!editPhone.trim()}
                />
              </div>
              {!editPhone.trim() && editWhatsappEnabled && (
                <p className="text-xs text-destructive">
                  Informe o telefone para habilitar o WhatsApp
                </p>
              )}
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