import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/auth_provider.dart';
import 'pick_list_screen.dart';
import 'dispatch_screen.dart';
import 'grn_screen.dart';

class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final role = auth.role ?? '';
    final name = auth.name ?? 'User';

    return Scaffold(
      appBar: AppBar(
        title: const Text('FreshOps'),
        actions: [
          IconButton(
            icon: const Icon(Icons.logout),
            tooltip: 'Sign out',
            onPressed: () => context.read<AuthProvider>().logout(),
          ),
        ],
      ),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Hello, $name', style: Theme.of(context).textTheme.titleLarge),
              Text(_roleLabel(role),
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: const Color(0xFF0D9488))),
              const SizedBox(height: 32),
              Expanded(child: _tiles(context, role)),
            ],
          ),
        ),
      ),
    );
  }

  String _roleLabel(String role) => switch (role) {
        'picker' => 'Picker',
        'driver' => 'Driver',
        'receiver' => 'Receiver',
        'admin' => 'Administrator',
        'ops_manager' => 'Operations Manager',
        _ => role,
      };

  Widget _tiles(BuildContext context, String role) {
    final tiles = <_Tile>[];

    if (role == 'picker' || role == 'admin' || role == 'ops_manager') {
      tiles.add(_Tile(
        icon: Icons.checklist,
        label: 'Pick Lists',
        color: const Color(0xFF0D9488),
        onTap: () => Navigator.push(context,
            MaterialPageRoute(builder: (_) => const PickListScreen())),
      ));
    }

    if (role == 'driver' || role == 'admin' || role == 'ops_manager') {
      tiles.add(_Tile(
        icon: Icons.local_shipping_outlined,
        label: 'Dispatch',
        color: const Color(0xFF0891B2),
        onTap: () => Navigator.push(context,
            MaterialPageRoute(builder: (_) => const DispatchScreen())),
      ));
    }

    if (role == 'receiver' || role == 'admin' || role == 'ops_manager') {
      tiles.add(_Tile(
        icon: Icons.move_to_inbox_outlined,
        label: 'Receive (GRN)',
        color: const Color(0xFF7C3AED),
        onTap: () => Navigator.push(context,
            MaterialPageRoute(builder: (_) => const GrnScreen())),
      ));
    }

    if (tiles.isEmpty) {
      return const Center(child: Text('No actions available for your role.'));
    }

    return GridView.count(
      crossAxisCount: 2,
      mainAxisSpacing: 16,
      crossAxisSpacing: 16,
      children: tiles.map((t) => _tileCard(context, t)).toList(),
    );
  }

  Widget _tileCard(BuildContext context, _Tile t) {
    return InkWell(
      onTap: t.onTap,
      borderRadius: BorderRadius.circular(16),
      child: Container(
        decoration: BoxDecoration(
          color: t.color.withOpacity(0.15),
          border: Border.all(color: t.color.withOpacity(0.4)),
          borderRadius: BorderRadius.circular(16),
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(t.icon, size: 48, color: t.color),
            const SizedBox(height: 12),
            Text(t.label,
                textAlign: TextAlign.center,
                style: TextStyle(color: t.color, fontWeight: FontWeight.w600)),
          ],
        ),
      ),
    );
  }
}

class _Tile {
  final IconData icon;
  final String label;
  final Color color;
  final VoidCallback onTap;
  const _Tile({required this.icon, required this.label, required this.color, required this.onTap});
}
