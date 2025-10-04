import { useState } from "react"
import { useQuery, useMutation } from "@tanstack/react-query"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { useConfirm } from "@/hooks/use-confirm"
import { useToast } from "@/hooks/use-toast"
import { useLanguage } from "@/hooks/use-language"
import { apiRequest, queryClient } from "@/lib/queryClient"
import { insertDepartmentSchema, type InsertDepartment, type Department } from "@shared/schema"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { z } from "zod"
import { 
  Database,
  Plus,
  Edit,
  Trash2,
  RefreshCw
} from "lucide-react"

const departmentFormSchema = insertDepartmentSchema.extend({
  name: z.string()
    .min(1, "Department name is required")
    .max(100, "Department name must be less than 100 characters")
});

type DepartmentFormData = z.infer<typeof departmentFormSchema>;

export default function AdminDataManagement() {
  const { confirm } = useConfirm()
  const { toast } = useToast()
  const { t } = useLanguage()
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [editingDepartment, setEditingDepartment] = useState<Department | null>(null)

  const addForm = useForm<DepartmentFormData>({
    resolver: zodResolver(departmentFormSchema),
    defaultValues: {
      name: ""
    }
  })

  const editForm = useForm<DepartmentFormData>({
    resolver: zodResolver(departmentFormSchema),
    defaultValues: {
      name: ""
    }
  })

  const { data: departments = [], isLoading: isLoadingDepartments, refetch: refetchDepartments } = useQuery<Department[]>({
    queryKey: ["/api/departments"],
  });

  const createDepartmentMutation = useMutation({
    mutationFn: async (departmentData: DepartmentFormData): Promise<Department> => {
      const response = await apiRequest('/api/admin/departments', { 
        method: 'POST', 
        body: departmentData 
      });
      return await response.json();
    },
    onSuccess: (newDepartment: Department) => {
      queryClient.invalidateQueries({ queryKey: ["/api/departments"] });
      setShowAddDialog(false);
      addForm.reset();
      toast({
        title: "Department Created",
        description: `Successfully created department "${newDepartment.name}"`,
      });
    },
    onError: (error: any) => {
      console.error('Error creating department:', error);
      toast({
        variant: "destructive",
        title: "Error Creating Department",
        description: error.message || "Failed to create department. Please try again.",
      });
    }
  });

  const updateDepartmentMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: DepartmentFormData }): Promise<Department> => {
      const response = await apiRequest(`/api/admin/departments/${id}`, { 
        method: 'PATCH', 
        body: data 
      });
      return await response.json();
    },
    onSuccess: (updatedDepartment: Department) => {
      queryClient.invalidateQueries({ queryKey: ["/api/departments"] });
      setShowEditDialog(false);
      setEditingDepartment(null);
      editForm.reset();
      toast({
        title: "Department Updated",
        description: `Successfully updated department "${updatedDepartment.name}"`,
      });
    },
    onError: (error: any) => {
      console.error('Error updating department:', error);
      toast({
        variant: "destructive",
        title: "Error Updating Department",
        description: error.message || "Failed to update department. Please try again.",
      });
    }
  });

  const deleteDepartmentMutation = useMutation({
    mutationFn: async (id: number): Promise<void> => {
      await apiRequest(`/api/admin/departments/${id}`, { method: 'DELETE' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/departments"] });
      toast({
        title: "Department Deleted",
        description: "Successfully deleted department",
      });
    },
    onError: (error: any) => {
      console.error('Error deleting department:', error);
      toast({
        variant: "destructive",
        title: "Error Deleting Department",
        description: error.message || "Failed to delete department. Please try again.",
      });
    }
  });

  const handleAddDepartment = async (data: DepartmentFormData) => {
    await createDepartmentMutation.mutateAsync(data);
  };

  const handleEditDepartment = async (data: DepartmentFormData) => {
    if (!editingDepartment) return;
    await updateDepartmentMutation.mutateAsync({ id: editingDepartment.id, data });
  };

  const handleDeleteDepartment = async (department: Department) => {
    const confirmed = await confirm({
      title: "Delete Department",
      description: `Are you sure you want to delete "${department.name}"? This action cannot be undone.`,
      confirmText: "Delete",
      cancelText: "Cancel",
      variant: "destructive"
    });

    if (confirmed) {
      await deleteDepartmentMutation.mutateAsync(department.id);
    }
  };

  const openEditDialog = (department: Department) => {
    setEditingDepartment(department);
    editForm.reset({ name: department.name });
    setShowEditDialog(true);
  };

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/departments"] });
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2" data-testid="text-page-title">
            <Database className="h-8 w-8 text-primary" />
            Data Management
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage departments and organizational data
          </p>
        </div>
        <Button 
          onClick={handleRefresh} 
          variant="outline" 
          size="icon"
          data-testid="button-refresh"
        >
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Departments
            </CardTitle>
            <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
              <DialogTrigger asChild>
                <Button data-testid="button-add-department">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Department
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add New Department</DialogTitle>
                </DialogHeader>
                <Form {...addForm}>
                  <form onSubmit={addForm.handleSubmit(handleAddDepartment)} className="space-y-4">
                    <FormField
                      control={addForm.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Department Name</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="Enter department name" 
                              {...field} 
                              data-testid="input-department-name"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="flex gap-2 justify-end">
                      <Button 
                        type="button" 
                        variant="outline" 
                        onClick={() => setShowAddDialog(false)}
                        data-testid="button-cancel-add"
                      >
                        Cancel
                      </Button>
                      <Button 
                        type="submit" 
                        disabled={createDepartmentMutation.isPending}
                        data-testid="button-submit-add"
                      >
                        {createDepartmentMutation.isPending ? "Creating..." : "Create Department"}
                      </Button>
                    </div>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {isLoadingDepartments ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Department Name</TableHead>
                  <TableHead>Created Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {departments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                      No departments found. Create your first department to get started.
                    </TableCell>
                  </TableRow>
                ) : (
                  departments.map((department) => (
                    <TableRow key={department.id} data-testid={`row-department-${department.id}`}>
                      <TableCell className="font-medium" data-testid={`text-department-name-${department.id}`}>
                        {department.name}
                      </TableCell>
                      <TableCell data-testid={`text-department-date-${department.id}`}>
                        {new Date(department.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-2 justify-end">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openEditDialog(department)}
                            data-testid={`button-edit-department-${department.id}`}
                          >
                            <Edit className="h-4 w-4 mr-1" />
                            Edit
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDeleteDepartment(department)}
                            data-testid={`button-delete-department-${department.id}`}
                          >
                            <Trash2 className="h-4 w-4 mr-1" />
                            Delete
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Department</DialogTitle>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(handleEditDepartment)} className="space-y-4">
              <FormField
                control={editForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Department Name</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Enter department name" 
                        {...field} 
                        data-testid="input-edit-department-name"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex gap-2 justify-end">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setShowEditDialog(false)}
                  data-testid="button-cancel-edit"
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={updateDepartmentMutation.isPending}
                  data-testid="button-submit-edit"
                >
                  {updateDepartmentMutation.isPending ? "Updating..." : "Update Department"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
