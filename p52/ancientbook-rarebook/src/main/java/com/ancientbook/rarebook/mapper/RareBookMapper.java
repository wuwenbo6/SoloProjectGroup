package com.ancientbook.rarebook.mapper;

import com.ancientbook.rarebook.dto.RareBookQueryDTO;
import com.ancientbook.rarebook.entity.RareBook;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;

@Mapper
public interface RareBookMapper {

    int insert(RareBook rareBook);

    int updateById(RareBook rareBook);

    int deleteById(@Param("id") Long id);

    RareBook selectById(@Param("id") Long id);

    RareBook selectByBookCode(@Param("bookCode") String bookCode);

    List<RareBook> selectList(RareBookQueryDTO queryDTO);

    long selectCount(RareBookQueryDTO queryDTO);
}
