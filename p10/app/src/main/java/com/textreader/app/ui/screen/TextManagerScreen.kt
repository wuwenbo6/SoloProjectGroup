package com.textreader.app.ui.screen

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.FavoriteBorder
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.textreader.app.viewmodel.MainViewModel
import com.textreader.data.entity.TextItem

@Composable
fun TextManagerScreen(viewModel: MainViewModel) {
    val textItems by viewModel.textItems
    val categories by viewModel.categories
    val selectedCategory by viewModel.selectedCategory
    var showAddDialog by remember { mutableStateOf(false) }

    val filteredItems = when (selectedCategory) {
        "全部" -> textItems
        "收藏" -> textItems.filter { it.isFavorite }
        else -> textItems.filter { it.category == selectedCategory }
    }

    Scaffold(
        floatingActionButton = {
            FloatingActionButton(onClick = { showAddDialog = true }) {
                Icon(Icons.Default.Add, contentDescription = "添加文本")
            }
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(16.dp)
        ) {
            var expanded by remember { mutableStateOf(false) }

            Button(onClick = { expanded = true }) {
                Text("分类: $selectedCategory")
            }

            DropdownMenu(
                expanded = expanded,
                onDismissRequest = { expanded = false }
            ) {
                categories.forEach { category ->
                    DropdownMenuItem(
                        text = { Text(category) },
                        onClick = {
                            viewModel.setCategory(category)
                            expanded = false
                        }
                    )
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            LazyColumn {
                items(filteredItems) { item ->
                    TextItemCard(
                        item = item,
                        onPlay = { viewModel.speak(item.content) },
                        onDelete = { viewModel.deleteTextItem(item) },
                        onToggleFavorite = { viewModel.toggleFavorite(item) }
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                }
            }
        }
    }

    if (showAddDialog) {
        AddTextDialog(
            onDismiss = { showAddDialog = false },
            onAdd = { title, content, category ->
                viewModel.addTextItem(content, title, category)
                showAddDialog = false
            }
        )
    }
}

@Composable
fun TextItemCard(
    item: TextItem,
    onPlay: () -> Unit,
    onDelete: () -> Unit,
    onToggleFavorite: () -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth()
    ) {
        Column(
            modifier = Modifier.padding(16.dp)
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier.fillMaxWidth()
            ) {
                Text(
                    text = item.title.ifEmpty { "无标题" },
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier.weight(1f)
                )

                IconButton(onClick = onToggleFavorite) {
                    Icon(
                        if (item.isFavorite) Icons.Default.Favorite else Icons.Default.FavoriteBorder,
                        contentDescription = "收藏"
                    )
                }

                IconButton(onClick = onPlay) {
                    Icon(Icons.Default.PlayArrow, contentDescription = "播放")
                }

                IconButton(onClick = onDelete) {
                    Icon(Icons.Default.Delete, contentDescription = "删除")
                }
            }

            if (item.category.isNotEmpty()) {
                Text(
                    text = "分类: ${item.category}",
                    style = androidx.compose.material3.MaterialTheme.typography.bodySmall
                )
            }

            Spacer(modifier = Modifier.height(8.dp))

            Text(
                text = item.content.take(100) + if (item.content.length > 100) "..." else "",
                style = androidx.compose.material3.MaterialTheme.typography.bodyMedium
            )
        }
    }
}

@Composable
fun AddTextDialog(
    onDismiss: () -> Unit,
    onAdd: (title: String, content: String, category: String) -> Unit
) {
    var title by remember { mutableStateOf("") }
    var content by remember { mutableStateOf("") }
    var category by remember { mutableStateOf("默认") }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("添加朗读文本") },
        text = {
            Column {
                OutlinedTextField(
                    value = title,
                    onValueChange = { title = it },
                    label = { Text("标题") },
                    modifier = Modifier.fillMaxWidth()
                )

                Spacer(modifier = Modifier.height(8.dp))

                OutlinedTextField(
                    value = content,
                    onValueChange = { content = it },
                    label = { Text("文本内容") },
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(200.dp),
                    maxLines = 10
                )

                Spacer(modifier = Modifier.height(8.dp))

                OutlinedTextField(
                    value = category,
                    onValueChange = { category = it },
                    label = { Text("分类") },
                    modifier = Modifier.fillMaxWidth()
                )
            }
        },
        confirmButton = {
            Button(
                onClick = { onAdd(title, content, category) },
                enabled = content.isNotBlank()
            ) {
                Text("添加")
            }
        },
        dismissButton = {
            Button(onClick = onDismiss) {
                Text("取消")
            }
        }
    )
}
