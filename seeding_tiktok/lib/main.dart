import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:file_picker/file_picker.dart';
import 'package:csv/csv.dart';
import 'package:path_provider/path_provider.dart';
import 'package:http/http.dart' as http;

void main() => runApp(const TikTokAccountManagerApp());

class TikTokAccountManagerApp extends StatelessWidget {
  const TikTokAccountManagerApp({super.key});

  @override
  Widget build(BuildContext context) {
    return const MaterialApp(
      debugShowCheckedModeBanner: false,
      home: AccountManagerScreen(),
    );
  }
}

class TikTokAccount {
  String username;
  String password;
  String privateKey;
  String cookies;
  String email;
  String emailPassword;
  String phone;
  String proxy;

  TikTokAccount({
    required this.username,
    required this.password,
    required this.privateKey,
    required this.cookies,
    required this.email,
    required this.emailPassword,
    required this.phone,
    required this.proxy,
  });

  factory TikTokAccount.fromJson(Map<String, dynamic> json) {
    return TikTokAccount(
      username: json['username'] ?? '',
      password: json['password'] ?? '',
      privateKey: json['privateKey'] ?? '',
      cookies: json['cookiesRaw'] ?? '',
      email: json['email'] ?? '',
      emailPassword: json['emailPassword'] ?? '',
      phone: json['phone'] ?? '',
      proxy: json['proxy'] ?? '',
    );
  }

  Map<String, dynamic> toJson() => {
        'username': username,
        'password': password,
        'privateKey': privateKey,
        'cookiesRaw': cookies,
        'email': email,
        'emailPassword': emailPassword,
        'phone': phone,
        'proxy': proxy,
      };
}

class AccountManagerScreen extends StatefulWidget {
  const AccountManagerScreen({super.key});

  @override
  State<AccountManagerScreen> createState() => _AccountManagerScreenState();
}

class _AccountManagerScreenState extends State<AccountManagerScreen> {
  final List<TikTokAccount> accounts = [];
  Map<TikTokAccount, bool> _accountSelection = {};
  late File _storageFile;
  final _videoUrlController = TextEditingController();
  String _selectedAction = 'like';

  @override
  void initState() {
    super.initState();
    _initStorage();
  }

  Future<void> _initStorage() async {
    final dir = await getApplicationDocumentsDirectory();
    _storageFile = File('${dir.path}/accounts.json');
    _loadAccounts();
  }

  void _updateAccountSelectionMap() {
    _accountSelection = {
      for (var acc in accounts) acc: _accountSelection[acc] ?? false,
    };
  }

  Future<void> _loadAccounts() async {
    if (await _storageFile.exists()) {
      final content = await _storageFile.readAsString();
      final List<dynamic> jsonData = jsonDecode(content);
      setState(() {
        accounts.clear();
        accounts.addAll(jsonData.map((e) => TikTokAccount.fromJson(e)));
        _updateAccountSelectionMap();
      });
    }
  }

  Future<void> _saveAccounts() async {
    final jsonData = jsonEncode(accounts.map((e) => e.toJson()).toList());
    await _storageFile.writeAsString(jsonData);
  }

  void _addAccount() {
    _showAccountDialog();
  }

  void _editAccount(int index) {
    _showAccountDialog(editIndex: index);
  }

  void _showAccountDialog({int? editIndex}) {
    final isEditing = editIndex != null;
    final account = isEditing ? accounts[editIndex] : null;

    final usernameController =
        TextEditingController(text: account?.username ?? '');
    final passwordController =
        TextEditingController(text: account?.password ?? '');
    final privateKeyController =
        TextEditingController(text: account?.privateKey ?? '');
    final cookiesController =
        TextEditingController(text: account?.cookies ?? '');
    final emailController = TextEditingController(text: account?.email ?? '');
    final emailPasswordController =
        TextEditingController(text: account?.emailPassword ?? '');
    final phoneController = TextEditingController(text: account?.phone ?? '');
    final proxyController = TextEditingController(text: account?.proxy ?? '');

    showDialog(
      context: context,
      builder: (context) {
        return AlertDialog(
          title: Text(isEditing ? 'Sửa tài khoản' : 'Thêm tài khoản TikTok'),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextField(
                    controller: usernameController,
                    decoration:
                        const InputDecoration(labelText: 'Tên người dùng')),
                TextField(
                    controller: passwordController,
                    decoration: const InputDecoration(labelText: 'Mật khẩu')),
                TextField(
                    controller: privateKeyController,
                    decoration:
                        const InputDecoration(labelText: 'Private Key')),
                TextField(
                    controller: cookiesController,
                    decoration: const InputDecoration(labelText: 'Cookies')),
                TextField(
                    controller: emailController,
                    decoration: const InputDecoration(labelText: 'Email')),
                TextField(
                    controller: emailPasswordController,
                    decoration:
                        const InputDecoration(labelText: 'Mật khẩu Email')),
                TextField(
                    controller: phoneController,
                    decoration:
                        const InputDecoration(labelText: 'Số điện thoại')),
                TextField(
                    controller: proxyController,
                    decoration: const InputDecoration(labelText: 'Proxy')),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () async {
                setState(() {
                  final newAcc = TikTokAccount(
                    username: usernameController.text,
                    password: passwordController.text,
                    privateKey: privateKeyController.text,
                    cookies: cookiesController.text,
                    email: emailController.text,
                    emailPassword: emailPasswordController.text,
                    phone: phoneController.text,
                    proxy: proxyController.text,
                  );

                  if (isEditing) {
                    accounts[editIndex!] = newAcc;
                  } else {
                    accounts.add(newAcc);
                  }
                  _updateAccountSelectionMap();
                });
                await _saveAccounts();
                Navigator.pop(context);
              },
              child: Text(isEditing ? 'Cập nhật' : 'Lưu lại'),
            ),
          ],
        );
      },
    );
  }

  void _importFromCSV() async {
    final result = await FilePicker.platform.pickFiles(
      type: FileType.custom,
      allowedExtensions: ['csv'],
    );

    if (result != null && result.files.single.path != null) {
      final file = File(result.files.single.path!);
      final raw = await file.readAsString();
      final rows = const CsvToListConverter().convert(raw, eol: '\n');

      setState(() {
        for (final row in rows.skip(1)) {
          accounts.add(
            TikTokAccount(
              username: row.isNotEmpty ? row[0].toString() : '',
              password: row.length > 1 ? row[1].toString() : '',
              privateKey: row.length > 2 ? row[2].toString() : '',
              cookies: row.length > 3 ? row[3].toString() : '',
              email: row.length > 4 ? row[4].toString() : '',
              emailPassword: row.length > 5 ? row[5].toString() : '',
              phone: row.length > 6 ? row[6].toString() : '',
              proxy: row.length > 7 ? row[7].toString() : '',
            ),
          );
        }
        _updateAccountSelectionMap();
      });
      await _saveAccounts();
    }
  }

  void _exportToCSV() async {
    List<List<String>> csvData = [
      [
        'username',
        'password',
        'privateKey',
        'cookiesRaw',
        'email',
        'emailPassword',
        'phone'
      ],
      ...accounts.map((a) => [
            a.username,
            a.password,
            a.privateKey,
            a.cookies,
            a.email,
            a.emailPassword,
            a.phone,
          ])
    ];

    String csv = const ListToCsvConverter().convert(csvData);
    final directory = await getTemporaryDirectory();
    final outputFile = File('${directory.path}/tiktok_accounts_export.csv');
    await outputFile.writeAsString(csv);

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('Đã export ra: ${outputFile.path}')),
    );
  }

  void _removeAccount(int index) async {
    setState(() {
      accounts.removeAt(index);
      _updateAccountSelectionMap();
    });
    await _saveAccounts();
  }

  void _sendTikTokAction() async {
    if (_videoUrlController.text.isEmpty || _selectedAction.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
            content: Text('Vui lòng nhập video URL và chọn hành động')),
      );
      return;
    }

    final url = Uri.parse('http://localhost:3000/tiktok/action');

    final payload = {
      'users': _accountSelection.entries
          .where((e) => e.value)
          .map((e) => {
                'username': e.key.username,
                'password': e.key.password,
                'cookiesRaw': e.key.cookies,
              })
          .toList(),
      'action': _selectedAction,
      'videoUrl': _videoUrlController.text,
    };

    try {
      final response = await http.post(
        url,
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode(payload),
      );

      if (response.statusCode == 200) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Lệnh đã gửi thành công')),
        );
      } else {
        try {
          final responseJson = jsonDecode(response.body);
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
                content: Text(
                    'Lỗi server: ${responseJson['message'] ?? response.body}')),
          );
        } catch (e) {
          // Nếu không phải là JSON, thì chỉ in ra body
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('Lỗi server: ${response.body}')),
          );
        }
      }
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Lỗi kết nối: $e')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Quản lý tài khoản TikTok'),
        actions: [
          TextButton.icon(
            onPressed: _importFromCSV,
            icon: const Icon(Icons.upload_file, color: Colors.white),
            label:
                const Text('Import CSV', style: TextStyle(color: Colors.white)),
          ),
          TextButton.icon(
            onPressed: _exportToCSV,
            icon: const Icon(Icons.download, color: Colors.white),
            label:
                const Text('Export CSV', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
      body: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Card(
              shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(16)),
              elevation: 4,
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: TextField(
                            controller: _videoUrlController,
                            decoration: const InputDecoration(
                              labelText: 'Link TikTok video/live',
                              border: OutlineInputBorder(),
                            ),
                          ),
                        ),
                        const SizedBox(width: 12),
                        DropdownButton<String>(
                          value: _selectedAction,
                          borderRadius: BorderRadius.circular(12),
                          items: ['like', 'comment', 'share']
                              .map((e) =>
                                  DropdownMenuItem(value: e, child: Text(e)))
                              .toList(),
                          onChanged: (val) =>
                              setState(() => _selectedAction = val!),
                        ),
                        const SizedBox(width: 12),
                        ElevatedButton.icon(
                          icon: const Icon(Icons.send),
                          label: const Text('Gửi lệnh'),
                          onPressed: _sendTikTokAction,
                          style: ElevatedButton.styleFrom(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 20, vertical: 14),
                            shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(12)),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    Row(
                      children: [
                        ElevatedButton.icon(
                          icon: const Icon(Icons.select_all),
                          label: const Text('Chọn tất cả / Bỏ chọn tất cả'),
                          onPressed: () {
                            final allSelected =
                                _accountSelection.values.every((e) => e);
                            setState(() {
                              _accountSelection
                                  .updateAll((key, value) => !allSelected);
                            });
                          },
                        ),
                        const SizedBox(width: 12),
                        ElevatedButton.icon(
                          icon: const Icon(Icons.upload_file),
                          label: const Text('Import CSV'),
                          onPressed: _importFromCSV,
                        ),
                        const SizedBox(width: 12),
                        ElevatedButton.icon(
                          icon: const Icon(Icons.download),
                          label: const Text('Export CSV'),
                          onPressed: _exportToCSV,
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 16),
            Text(
              'Danh sách tài khoản',
              style: Theme.of(context)
                  .textTheme
                  .titleLarge
                  ?.copyWith(fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 8),
            Expanded(
              child: Card(
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(16)),
                elevation: 4,
                child: Padding(
                  padding: const EdgeInsets.all(8),
                  child: SingleChildScrollView(
                    scrollDirection: Axis.horizontal,
                    child: DataTable(
                      columnSpacing: 20,
                      headingRowColor: MaterialStateColor.resolveWith(
                          (states) => Colors.grey.shade200),
                      dataRowColor: MaterialStateColor.resolveWith(
                          (states) => Colors.white),
                      columns: const [
                        DataColumn(label: Text('STT')),
                        DataColumn(label: Text('Tên người dùng')),
                        DataColumn(label: Text('Mật khẩu')),
                        DataColumn(label: Text('Private Key')),
                        DataColumn(label: Text('Cookies')),
                        DataColumn(label: Text('Email')),
                        DataColumn(label: Text('Mật khẩu Mail')),
                        DataColumn(label: Text('Phone')),
                        DataColumn(label: Text('Proxy')),
                        DataColumn(label: Text('Hành động')),
                      ],
                      rows: List<DataRow>.generate(
                        accounts.length,
                        (index) {
                          final acc = accounts[index];
                          return DataRow(
                            selected: _accountSelection[acc] ?? false,
                            onSelectChanged: (selected) {
                              setState(() {
                                _accountSelection[acc] = selected ?? false;
                              });
                            },
                            cells: [
                              DataCell(Text('${index + 1}')),
                              DataCell(Text(acc.username)),
                              DataCell(Text(acc.password)),
                              DataCell(Text(acc.privateKey)),
                              DataCell(
                                TextButton(
                                  child: const Text('Xem'),
                                  onPressed: () {
                                    showDialog(
                                      context: context,
                                      builder: (_) => AlertDialog(
                                        title: const Text('Cookies'),
                                        content: SingleChildScrollView(
                                            child: Text(acc.cookies)),
                                        actions: [
                                          TextButton(
                                              onPressed: () =>
                                                  Navigator.pop(context),
                                              child: const Text('Đóng')),
                                        ],
                                      ),
                                    );
                                  },
                                ),
                              ),
                              DataCell(Text(acc.email)),
                              DataCell(Text(acc.emailPassword)),
                              DataCell(Text(acc.phone)),
                              DataCell(Text(acc.proxy)),
                              DataCell(Row(
                                children: [
                                  IconButton(
                                    icon: const Icon(Icons.edit,
                                        color: Colors.blue),
                                    onPressed: () => _editAccount(index),
                                  ),
                                  IconButton(
                                    icon: const Icon(Icons.delete,
                                        color: Colors.red),
                                    onPressed: () => _removeAccount(index),
                                  ),
                                ],
                              )),
                            ],
                          );
                        },
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: _addAccount,
        child: const Icon(Icons.add),
      ),
    );
  }
}
